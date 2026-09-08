import { z } from "zod";

/**
 * A ficha pública de uma empresa, pelo CNPJ.
 *
 * Fonte: BrasilAPI, que serve os dados abertos da Receita Federal. É gratuita e
 * sem chave — e essa escolha tem consequência: ela pode cair, e quando cair a
 * conversa não pode cair junto. Por isso tudo aqui degrada para "não consegui
 * consultar agora" em vez de erro.
 *
 * O QUE NÃO EXISTE NESSA BASE: número de funcionários. A Receita publica
 * atividade, porte, natureza jurídica, capital e o quadro de sócios; quadro de
 * pessoal vem de RAIS/CAGED/eSocial, que não é aberto por empresa. Por isso
 * `funcionarios` volta sempre nulo, e o campo existe justamente para o modelo
 * VER que não existe — sem ele, "quantos funcionários?" viraria chute.
 *
 * O que dá para inferir de porte de equipe é indireto: `porte` (ME/EPP/demais),
 * capital social e número de sócios. Perguntar continua sendo mais barato e
 * mais exato do que estimar.
 */

const ENDERECO =
  process.env.SITE_ASTRO_CNPJ_API ?? "https://brasilapi.com.br/api/cnpj/v1";

/** O visitante está esperando: consulta que demora vira conversa travada. */
const TIMEOUT_MS = 5_000;

/**
 * Quem está chamando.
 *
 * Sem isto a BrasilAPI devolve 403: o `fetch` do Node não manda `user-agent`,
 * e a borda dela trata requisição anônima como robô. Além de destravar, é
 * educação — API pública e gratuita merece saber quem a está usando.
 */
const AGENTE = "orbita-astro/1.0 (+https://orbita.nasaex.com)";

/** Cadastro de empresa não muda no almoço. */
const CACHE_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX = 200;

export type Socio = {
  nome: string;
  qualificacao: string;
  desde: string | null;
};

export type EmpresaPublica = {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  atividadePrincipal: string | null;
  atividadesSecundarias: string[];
  naturezaJuridica: string | null;
  porte: string | null;
  capitalSocial: number | null;
  situacao: string | null;
  abertaEm: string | null;
  anosDeCasa: number | null;
  municipio: string | null;
  uf: string | null;
  matriz: boolean;
  simples: boolean | null;
  mei: boolean | null;
  socios: Socio[];
  /** Sempre nulo: a base pública não tem quadro de pessoal. Ver o topo. */
  funcionarios: null;
};

export type ResultadoCnpj =
  | { ok: true; empresa: EmpresaPublica }
  | { ok: false; motivo: "invalido" | "nao_encontrado" | "indisponivel" };

/**
 * Só os caracteres que compõem um CNPJ.
 *
 * Letras entram porque desde 2026 a Receita emite CNPJ alfanumérico: os doze
 * primeiros caracteres podem ser letra ou dígito, e só os dois verificadores
 * continuam numéricos.
 */
export function limparCnpj(valor: string): string {
  return valor
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .slice(0, 14);
}

/**
 * Os dois dígitos verificadores, pelo módulo 11 da Receita.
 *
 * Validar antes de sair para a rede não é purismo: erro de digitação é o caso
 * comum, e cada tentativa inválida seria uma chamada gasta na API pública.
 *
 * O valor de cada caractere é o código ASCII menos 48 — que dá 0..9 para os
 * dígitos e 17..42 para as letras, exatamente como a regra do CNPJ
 * alfanumérico define. Para um CNPJ numérico, a conta é a de sempre.
 */
export function cnpjValido(valor: string): boolean {
  const cnpj = limparCnpj(valor);
  if (cnpj.length !== 14) return false;
  // "00000000000000" fecha a conta e não é CNPJ de ninguém.
  if (/^(.)\1{13}$/.test(cnpj)) return false;
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj)) return false;

  const digito = (ate: number): number => {
    let peso = ate - 7;
    let soma = 0;
    for (let i = 0; i < ate; i++) {
      soma += (cnpj.charCodeAt(i) - 48) * peso;
      peso -= 1;
      if (peso < 2) peso = 9;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  return digito(12) === Number(cnpj[12]) && digito(13) === Number(cnpj[13]);
}

/**
 * O corpo da BrasilAPI, lido com folga.
 *
 * Tudo opcional de propósito: um campo que a API pare de mandar deve custar um
 * dado a menos na ficha, nunca uma consulta perdida.
 */
const respostaSchema = z.object({
  cnpj: z.string().optional(),
  razao_social: z.string().optional(),
  nome_fantasia: z.string().optional(),
  cnae_fiscal_descricao: z.string().optional(),
  cnaes_secundarios: z
    .array(z.object({ descricao: z.string().optional() }))
    .optional(),
  natureza_juridica: z.string().optional(),
  porte: z.string().optional(),
  capital_social: z.union([z.number(), z.string()]).optional(),
  descricao_situacao_cadastral: z.string().optional(),
  data_inicio_atividade: z.string().optional(),
  municipio: z.string().optional(),
  uf: z.string().optional(),
  descricao_identificador_matriz_filial: z.string().optional(),
  opcao_pelo_simples: z.boolean().nullish(),
  opcao_pelo_mei: z.boolean().nullish(),
  qsa: z
    .array(
      z.object({
        nome_socio: z.string().optional(),
        qualificacao_socio: z.string().optional(),
        data_entrada_sociedade: z.string().optional(),
      }),
    )
    .optional(),
});

/** Quantos anos completos desde a abertura. É o que vira "anos de casa". */
function anosDesde(data: string | undefined, agora: Date): number | null {
  if (!data) return null;
  const inicio = new Date(data);
  if (Number.isNaN(inicio.getTime())) return null;
  const anos = (agora.getTime() - inicio.getTime()) / (365.25 * 864e5);
  return anos >= 0 ? Math.floor(anos) : null;
}

function texto(valor: string | undefined): string | null {
  const limpo = valor?.trim();
  return limpo ? limpo : null;
}

/** Só os três primeiros CNAEs secundários: o resto é ruído no prompt. */
const SECUNDARIAS_NO_MAXIMO = 3;

/** E só os seis primeiros sócios, pelo mesmo motivo. */
const SOCIOS_NO_MAXIMO = 6;

function montarEmpresa(
  cru: z.infer<typeof respostaSchema>,
  cnpj: string,
  agora: Date,
): EmpresaPublica {
  const capital =
    typeof cru.capital_social === "string"
      ? Number(cru.capital_social)
      : cru.capital_social;

  return {
    cnpj,
    razaoSocial: texto(cru.razao_social) ?? "",
    nomeFantasia: texto(cru.nome_fantasia),
    atividadePrincipal: texto(cru.cnae_fiscal_descricao),
    atividadesSecundarias: (cru.cnaes_secundarios ?? [])
      .map((item) => texto(item.descricao))
      .filter((item): item is string => item !== null)
      .slice(0, SECUNDARIAS_NO_MAXIMO),
    naturezaJuridica: texto(cru.natureza_juridica),
    porte: texto(cru.porte),
    capitalSocial:
      typeof capital === "number" && Number.isFinite(capital) ? capital : null,
    situacao: texto(cru.descricao_situacao_cadastral),
    abertaEm: texto(cru.data_inicio_atividade),
    anosDeCasa: anosDesde(cru.data_inicio_atividade, agora),
    municipio: texto(cru.municipio),
    uf: texto(cru.uf),
    matriz: (cru.descricao_identificador_matriz_filial ?? "")
      .toUpperCase()
      .includes("MATRIZ"),
    simples: cru.opcao_pelo_simples ?? null,
    mei: cru.opcao_pelo_mei ?? null,
    socios: (cru.qsa ?? [])
      .map((socio) => ({
        nome: texto(socio.nome_socio) ?? "",
        qualificacao: texto(socio.qualificacao_socio) ?? "",
        desde: texto(socio.data_entrada_sociedade),
      }))
      .filter((socio) => socio.nome !== "")
      .slice(0, SOCIOS_NO_MAXIMO),
    funcionarios: null,
  };
}

/** Exportado para o teste: a leitura do corpo não depende de rede. */
export function lerRespostaDaApi(
  corpo: unknown,
  cnpj: string,
  agora = new Date(),
): EmpresaPublica | null {
  const lido = respostaSchema.safeParse(corpo);
  if (!lido.success) return null;
  const empresa = montarEmpresa(lido.data, cnpj, agora);
  // Sem razão social não há ficha: é o mínimo que a Receita sempre devolve.
  return empresa.razaoSocial ? empresa : null;
}

const cache = new Map<string, { em: number; resultado: ResultadoCnpj }>();

function guardar(cnpj: string, resultado: ResultadoCnpj) {
  // API fora do ar é estado passageiro; guardar isso seria transformar um
  // soluço de trinta segundos em seis horas de "não consigo consultar".
  if (!resultado.ok && resultado.motivo === "indisponivel") return;
  if (cache.size >= CACHE_MAX) {
    const maisVelho = cache.keys().next().value;
    if (maisVelho) cache.delete(maisVelho);
  }
  cache.set(cnpj, { em: Date.now(), resultado });
}

export async function consultarCnpj(bruto: string): Promise<ResultadoCnpj> {
  const cnpj = limparCnpj(bruto);
  if (!cnpjValido(cnpj)) return { ok: false, motivo: "invalido" };

  const guardado = cache.get(cnpj);
  if (guardado && Date.now() - guardado.em < CACHE_MS)
    return guardado.resultado;

  let resposta: Response;
  try {
    resposta = await fetch(`${ENDERECO}/${cnpj}`, {
      headers: { accept: "application/json", "user-agent": AGENTE },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return { ok: false, motivo: "indisponivel" };
  }

  if (resposta.status === 404) {
    const resultado: ResultadoCnpj = { ok: false, motivo: "nao_encontrado" };
    guardar(cnpj, resultado);
    return resultado;
  }
  if (!resposta.ok) return { ok: false, motivo: "indisponivel" };

  const corpo = await resposta.json().catch(() => null);
  const empresa = lerRespostaDaApi(corpo, cnpj);
  if (!empresa) return { ok: false, motivo: "indisponivel" };

  const resultado: ResultadoCnpj = { ok: true, empresa };
  guardar(cnpj, resultado);
  return resultado;
}
