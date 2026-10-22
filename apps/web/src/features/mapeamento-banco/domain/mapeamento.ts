import { z } from "zod";
import {
  ALVOS,
  type Alvo,
  CONVERSOES,
  CONVERSOES_POR_TIPO,
  TIPOS_DO_NERP,
  type TipoDoNerp,
  compatibilidade,
} from "./alvos";
import {
  type Tabela,
  acharColuna,
  ehTabelaGrande,
  formatarLinhas,
} from "./estrutura";

// O mapeamento salvo: para cada tipo do NERP, de onde vêm os dados no banco do
// cliente. Fica em `ErpConnection.dataMapping` como JSON versionado — mudança de
// formato sobe a `versao` em vez de quebrar o que já foi salvo.
//
// Nomes de tabela/coluna aqui são só CHAVES DE BUSCA: o adaptador revalida
// contra o catálogo do banco antes de qualquer SQL, e o que vai para a consulta
// é sempre o nome canônico que voltou de lá.

// Frouxo de propósito (vale para qualquer motor). A regra estrita de cada banco
// — 30 caracteres no Oracle, por exemplo — é do adaptador.
const identificador = z
  .string()
  .trim()
  .regex(/^[A-Za-z_][A-Za-z0-9_$#]{0,127}$/, "Nome inválido");

export const tabelaRefSchema = z.object({
  schema: identificador,
  nome: identificador,
});

/** Coluna da tabela principal ou da tabela juntada. */
export const colunaRefSchema = z.object({
  de: z.enum(["base", "juncao"]),
  nome: identificador,
});
export type ColunaRef = z.infer<typeof colunaRefSchema>;

export const OPERADORES = [
  "igual",
  "diferente",
  "em",
  "maiorOuIgual",
  "menorOuIgual",
  "vazio",
  "preenchido",
] as const;
export type Operador = (typeof OPERADORES)[number];

export const ROTULO_DO_OPERADOR: Record<Operador, string> = {
  igual: "igual a",
  diferente: "diferente de",
  em: "é um de",
  maiorOuIgual: "maior ou igual a",
  menorOuIgual: "menor ou igual a",
  vazio: "está vazio",
  preenchido: "está preenchido",
};

/** Quantos valores cada operador usa; `null` = um ou mais. */
const ARIDADE: Record<Operador, number | null> = {
  igual: 1,
  diferente: 1,
  em: null,
  maiorOuIgual: 1,
  menorOuIgual: 1,
  vazio: 0,
  preenchido: 0,
};

const MAX_VALORES_EM = 100;

export const filtroSchema = z
  .object({
    coluna: colunaRefSchema,
    operador: z.enum(OPERADORES),
    valores: z.array(z.union([z.string().max(200), z.number()])).default([]),
  })
  .superRefine((filtro, ctx) => {
    const aridade = ARIDADE[filtro.operador];
    if (aridade === null) {
      if (filtro.valores.length < 1 || filtro.valores.length > MAX_VALORES_EM) {
        ctx.addIssue({
          code: "custom",
          message: `Informe de 1 a ${MAX_VALORES_EM} valores.`,
        });
      }
      return;
    }
    if (filtro.valores.length !== aridade) {
      ctx.addIssue({
        code: "custom",
        message:
          aridade === 0 ? "Este operador não usa valor." : "Informe um valor.",
      });
    }
  });
export type Filtro = z.infer<typeof filtroSchema>;

export const origemSchema = z.object({
  tabela: tabelaRefSchema,
  // No máximo uma junção: cobre o caso real (região do preço está no
  // cabeçalho do pedido, não no item) sem virar um construtor de SQL.
  juncao: z
    .object({
      tabela: tabelaRefSchema,
      de: identificador,
      para: identificador,
    })
    .optional(),
  colunas: z.record(z.string(), colunaRefSchema).default({}),
  conversoes: z.record(z.string(), z.enum(CONVERSOES)).default({}),
  filtros: z.array(filtroSchema).max(8).default([]),
  janela: z
    .object({
      coluna: colunaRefSchema,
      dias: z.number().int().min(1).max(3650),
    })
    .optional(),
});
export type Origem = z.infer<typeof origemSchema>;

export const MODOS = ["auto", "manual", "desligado"] as const;
export type Modo = (typeof MODOS)[number];

export const configDoTipoSchema = z
  .object({
    modo: z.enum(MODOS).default("auto"),
    origem: origemSchema.optional(),
  })
  .refine((config) => config.modo !== "manual" || !!config.origem, {
    message: "Modo manual precisa de uma origem.",
  });
export type ConfigDoTipo = z.infer<typeof configDoTipoSchema>;

const tiposSchema = z.object(
  Object.fromEntries(
    TIPOS_DO_NERP.map((tipo) => [
      tipo,
      configDoTipoSchema.default({ modo: "auto" }),
    ]),
  ) as Record<TipoDoNerp, z.ZodDefault<typeof configDoTipoSchema>>,
);

export const mapeamentoSchema = z.object({
  versao: z.literal(1).default(1),
  tipos: tiposSchema.default({
    produto: { modo: "auto" },
    estoque: { modo: "auto" },
    categoria: { modo: "auto" },
    cliente: { modo: "auto" },
    preco: { modo: "auto" },
    promocao: { modo: "auto" },
  }),
});
export type Mapeamento = z.infer<typeof mapeamentoSchema>;

export function mapeamentoVazio(): Mapeamento {
  return mapeamentoSchema.parse({});
}

/**
 * Lê o JSON salvo sem nunca lançar: conteúdo inválido (versão futura, edição à
 * mão) volta como "tudo automático", que é o comportamento de quem nunca
 * mapeou nada.
 */
export function lerMapeamento(bruto: unknown): Mapeamento {
  const lido = mapeamentoSchema.safeParse(bruto ?? {});
  return lido.success ? lido.data : mapeamentoVazio();
}

export interface Estruturas {
  base: Tabela;
  juncao: Tabela | null;
}

export interface Diagnostico {
  erros: string[];
  avisos: string[];
}

function tabelaDa(ref: ColunaRef, estruturas: Estruturas): Tabela | null {
  return ref.de === "base" ? estruturas.base : estruturas.juncao;
}

/**
 * Confere uma origem contra a estrutura real das tabelas. Erro bloqueia salvar
 * e testar; aviso só informa (a conversão pode falhar em parte das linhas).
 */
export function validarOrigem(
  alvo: Alvo,
  origem: Origem,
  estruturas: Estruturas,
): Diagnostico {
  const erros: string[] = [];
  const avisos: string[] = [];
  const { base, juncao } = estruturas;

  if (origem.juncao) {
    if (!juncao) {
      erros.push(
        `A tabela da junção (${origem.juncao.tabela.nome}) não está acessível.`,
      );
    } else {
      if (!acharColuna(base, origem.juncao.de)) {
        erros.push(
          `Junção: a coluna ${origem.juncao.de} não existe em ${base.nome}.`,
        );
      }
      const para = acharColuna(juncao, origem.juncao.para);
      if (!para) {
        erros.push(
          `Junção: a coluna ${origem.juncao.para} não existe em ${juncao.nome}.`,
        );
      } else if (ehTabelaGrande(juncao) && !para.indexada) {
        avisos.push(
          `Junção: ${juncao.nome} é grande e ${para.nome} não tem índice — a leitura pode ficar lenta.`,
        );
      }
    }
  }

  const chavesDoAlvo = new Set(alvo.campos.map((campo) => campo.chave));
  for (const chave of Object.keys(origem.colunas)) {
    if (!chavesDoAlvo.has(chave)) {
      erros.push(`"${chave}" não é um campo de ${alvo.rotulo}.`);
    }
  }

  for (const campo of alvo.campos) {
    const ref = origem.colunas[campo.chave];
    const conversao = origem.conversoes[campo.chave];
    if (!ref) {
      if (campo.obrigatorio) erros.push(`"${campo.rotulo}" é obrigatório.`);
      continue;
    }
    const tabela = tabelaDa(ref, estruturas);
    if (!tabela) {
      erros.push(`"${campo.rotulo}" aponta para a junção, que não existe.`);
      continue;
    }
    const coluna = acharColuna(tabela, ref.nome);
    if (!coluna) {
      erros.push(
        `"${campo.rotulo}": a coluna ${ref.nome} não existe em ${tabela.nome}.`,
      );
      continue;
    }
    if (conversao && !CONVERSOES_POR_TIPO[campo.tipo].includes(conversao)) {
      erros.push(
        `"${campo.rotulo}" (${campo.tipo}) não aceita a conversão ${conversao}.`,
      );
      continue;
    }
    if (campo.tipo === "booleano") {
      if (!conversao) {
        erros.push(
          `"${campo.rotulo}" precisa de uma conversão (ex.: vazio = sim).`,
        );
      }
      continue;
    }
    const compat = compatibilidade(campo.tipo, coluna.tipo);
    if (compat === "erro") {
      erros.push(
        `"${campo.rotulo}" espera ${campo.tipo} e ${coluna.nome} é ${coluna.tipoNativo}.`,
      );
    } else if (compat === "aviso") {
      avisos.push(
        `"${campo.rotulo}" espera ${campo.tipo} e ${coluna.nome} é ${coluna.tipoNativo}: a conversão pode falhar em algumas linhas.`,
      );
    }
  }

  for (const filtro of origem.filtros) {
    const tabela = tabelaDa(filtro.coluna, estruturas);
    const coluna = tabela ? acharColuna(tabela, filtro.coluna.nome) : null;
    if (!tabela || !coluna) {
      erros.push(`Filtro: a coluna ${filtro.coluna.nome} não existe.`);
    } else if (ehTabelaGrande(tabela) && !coluna.indexada) {
      avisos.push(
        `Filtro em ${coluna.nome}: sem índice numa tabela grande, ele não reduz a leitura.`,
      );
    }
  }

  // Tabela grande só com janela de data na própria tabela, numa coluna que abre
  // índice — senão cada leitura do sync varre milhões de linhas no ERP.
  if (ehTabelaGrande(base)) {
    const janela = origem.janela;
    if (!janela || janela.coluna.de !== "base") {
      erros.push(
        `${base.nome} tem ${formatarLinhas(base.linhas)} linhas: defina uma janela de data numa coluna dela.`,
      );
    }
  }
  if (origem.janela) {
    const tabela = tabelaDa(origem.janela.coluna, estruturas);
    const coluna = tabela
      ? acharColuna(tabela, origem.janela.coluna.nome)
      : null;
    if (!tabela || !coluna) {
      erros.push(`Janela: a coluna ${origem.janela.coluna.nome} não existe.`);
    } else if (coluna.tipo !== "data") {
      erros.push(`Janela: ${coluna.nome} não é uma coluna de data.`);
    } else if (ehTabelaGrande(tabela) && !coluna.indiceLider) {
      erros.push(
        `Janela: ${coluna.nome} não abre nenhum índice de ${tabela.nome}; o banco leria a tabela inteira.`,
      );
    }
  }

  return { erros, avisos };
}

export function alvoDo(tipo: TipoDoNerp): Alvo {
  return ALVOS[tipo];
}
