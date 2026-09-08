import {
  CATEGORIES,
  type CategoryId,
  findCatalogTool,
  RAW_TOOLS,
  type Tool,
} from "./catalog";
import { METODO_ETAPAS, type MetodoEtapa, METODO_PRINCIPIO } from "./metodo";
import { compareFor, solutionSlug } from "./pages";
import { type Segment, SEGMENTS } from "./segments";

/**
 * O catálogo visto pelo consultor de IA.
 *
 * Duas responsabilidades, e a divisão entre elas é o que segura o custo:
 *
 * - os **índices** (`CONSULTOR_*_INDEX`) são curtos e entram no prompt fixo de
 *   toda conversa. São eles que impedem o modelo de inventar uma ferramenta
 *   que não existe;
 * - o **detalhe** sai por função, sob demanda. O texto de dor↔solução das 28
 *   ferramentas junto passa de 30 mil caracteres: no prompt fixo, seria pago
 *   em toda mensagem de toda conversa, para responder sobre uma ferramenta só.
 *
 * Tudo aqui é função pura sobre as constantes do pacote — sem banco, sem rede,
 * sem embedding. O que se paga é o que o modelo pedir.
 */

/** Os ids válidos. Nada fora desta lista é ferramenta da suíte. */
export const CONSULTOR_TOOL_IDS: string[] = RAW_TOOLS.map((tool) => tool.id);

/**
 * O id de uma ferramenta a partir do que o modelo escreveu.
 *
 * Ele passa o id quando lembra, e o nome quando não lembra ("Catálogo
 * Promocional", "ORBITA PDV"). Descartar o nome custa caro: o escopo do
 * negócio some do lead e a estimativa sai sem os módulos. Então resolve-se os
 * dois, e nada além dos dois — texto que não casa com ferramenta nenhuma
 * continua sendo descartado.
 */
export function resolverIdDeFerramenta(entrada: string): string | null {
  const bruto = entrada.trim();
  if (!bruto) return null;
  if (findCatalogTool(bruto)) return bruto;

  const alvo = normalizar(bruto)
    .replace(/^orbita\s+/, "")
    .trim();
  const porNome = RAW_TOOLS.find((tool) => {
    const nome = normalizar(tool.name);
    const completo = normalizar(tool.fullName).replace(/^orbita\s+/, "");
    return nome === alvo || completo === alvo;
  });
  return porNome?.id ?? null;
}

/** Resolve uma lista, sem repetir e sem o que não existe. */
export function resolverIdsDeFerramentas(entradas: string[]): string[] {
  const ids = new Set<string>();
  for (const entrada of entradas) {
    const id = resolverIdDeFerramenta(entrada);
    if (id) ids.add(id);
  }
  return [...ids];
}

/** O endereço público de uma ferramenta, quando ela tem página. */
export function hrefForTool(toolId: string): string | null {
  const tool = findCatalogTool(toolId);
  if (!tool) return null;
  if (tool.href) return tool.href;
  const slug = solutionSlug(toolId);
  return slug ? `/solucoes/${slug}` : null;
}

// ─── Índices para o prompt ────────────────────────────────────────────────────

/** Uma linha por ferramenta: id, nome, categoria e a frase de uma linha. */
export const CONSULTOR_TOOL_INDEX: string = RAW_TOOLS.map(
  (tool) => `${tool.id} | ${tool.name} | ${tool.category} | ${tool.tagline}`,
).join("\n");

/** Uma linha por segmento, com as ferramentas que abrem a página dele. */
export const CONSULTOR_SEGMENT_INDEX: string = SEGMENTS.map(
  (segment) =>
    `${segment.id} | ${segment.name} | ${segment.summary} | ${segment.tools.join(", ")}`,
).join("\n");

/** As categorias, para o modelo saber em que prateleira cada coisa está. */
export const CONSULTOR_CATEGORY_INDEX: string = CATEGORIES.map(
  (category) => `${category.id} | ${category.title} | ${category.lead}`,
).join("\n");

/**
 * O método em quatro linhas. O texto integral de cada etapa sai por
 * `explicarMetodo` — aqui fica só o suficiente para o modelo saber que existe
 * e quando puxar o detalhe.
 */
export const CONSULTOR_METODO_RESUMO: string = METODO_ETAPAS.map(
  (etapa) => `${etapa.mark} — ${etapa.title}: ${etapa.question}`,
).join("\n");

// ─── Busca determinística ─────────────────────────────────────────────────────

/**
 * As palavras que aparecem em qualquer frase e não distinguem nada. Sem esta
 * lista, "não consigo controlar meu estoque" casaria com tudo pelo "não".
 */
const STOPWORDS = new Set([
  "para",
  "pelo",
  "pela",
  "com",
  "sem",
  "que",
  "nao",
  "dos",
  "das",
  "meu",
  "meus",
  "minha",
  "minhas",
  "tenho",
  "temos",
  "preciso",
  "quero",
  "queria",
  "consigo",
  "conseguir",
  "fazer",
  "faco",
  "muito",
  "muita",
  "mais",
  "menos",
  "toda",
  "todo",
  "todos",
  "todas",
  "cada",
  "esta",
  "este",
  "isso",
  "aqui",
  "onde",
  "como",
  "quando",
  "porque",
  "gente",
  "coisa",
  "empresa",
  "negocio",
  "sempre",
  "nunca",
  "ainda",
  "sobre",
  "entre",
  "pra",
  "por",
]);

/** Minúsculas e sem acento — é assim que os dois lados da busca se encontram. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Uma forma reduzida do termo, para o plural do cliente encontrar o singular
 * do catálogo ("vendedores" → "vendedor"). Não é stemming de verdade: é o
 * mínimo que resolve o caso comum sem uma tabela de exceções para manter.
 */
function reduzir(termo: string): string {
  if (termo.length > 5 && termo.endsWith("es")) return termo.slice(0, -2);
  if (termo.length > 4 && termo.endsWith("s")) return termo.slice(0, -1);
  return termo;
}

function termosDe(texto: string): string[] {
  const vistos = new Set<string>();
  for (const bruto of normalizar(texto).split(/[^a-z0-9]+/)) {
    if (bruto.length < 3 || STOPWORDS.has(bruto)) continue;
    vistos.add(bruto);
  }
  return [...vistos];
}

/**
 * Os pesos de cada campo. O `less` do compare pesa mais que tudo porque ele é,
 * literalmente, a lista de dores que a ferramenta resolve ("Preço divergente
 * entre a gôndola e o caixa") — é o campo escrito na língua de quem sofre o
 * problema, não na de quem vende a solução.
 */
const PESOS = {
  nome: 6,
  dor: 5,
  tagline: 4,
  funcionalidade: 3,
  resumo: 2,
  ganho: 2,
} as const;

/**
 * Fração da pontuação do primeiro colocado que um resultado precisa alcançar
 * para ser devolvido. Serve de piso: metade do melhor.
 */
const RELEVANCIA_MINIMA = 0.5;

type CampoPeso = { texto: string; peso: number; rotulo: string };

/** Os campos buscáveis de uma ferramenta, já normalizados. Montado uma vez. */
function camposDe(tool: Tool): CampoPeso[] {
  const comparacao = compareFor(tool.id);
  const campos: CampoPeso[] = [
    {
      texto: normalizar(`${tool.name} ${tool.fullName}`),
      peso: PESOS.nome,
      rotulo: "nome",
    },
    { texto: normalizar(tool.tagline), peso: PESOS.tagline, rotulo: "tagline" },
    { texto: normalizar(tool.summary), peso: PESOS.resumo, rotulo: "resumo" },
    {
      texto: normalizar(
        tool.features.map((f) => `${f.title} ${f.description}`).join(" "),
      ),
      peso: PESOS.funcionalidade,
      rotulo: "funcionalidade",
    },
  ];
  if (comparacao) {
    campos.push({
      texto: normalizar(comparacao.less.join(" ")),
      peso: PESOS.dor,
      rotulo: "dor",
    });
    campos.push({
      texto: normalizar(comparacao.more.join(" ")),
      peso: PESOS.ganho,
      rotulo: "ganho",
    });
  }
  return campos;
}

/** O índice é montado no carregamento do módulo: 28 ferramentas, uma vez só. */
const INDICE: Array<{ tool: Tool; campos: CampoPeso[] }> = RAW_TOOLS.map(
  (tool) => ({ tool, campos: camposDe(tool) }),
);

export type FerramentaEncontrada = {
  id: string;
  nome: string;
  categoria: CategoryId;
  tagline: string;
  href: string | null;
  /** Por que ela apareceu — "dor", "funcionalidade", "nome"… */
  motivo: string[];
};

export type BuscaFerramentas = {
  /** Texto livre do cliente. É aqui que a dor entra. */
  dor?: string;
  segmento?: string;
  categoria?: string;
  limite?: number;
};

/**
 * As ferramentas que respondem ao que o cliente descreveu.
 *
 * Sem `dor`, é uma listagem filtrada (por segmento ou categoria) na ordem do
 * catálogo. Com `dor`, é a busca por pontuação — e o segmento, quando vem
 * junto, empurra para cima as ferramentas daquele segmento em vez de excluir
 * as outras: quem tem uma clínica pode precisar de algo que não está na lista
 * curada de clínicas.
 */
export function buscarFerramentas(
  entrada: BuscaFerramentas = {},
): FerramentaEncontrada[] {
  const limite = Math.min(Math.max(entrada.limite ?? 6, 1), 12);
  const segmento = entrada.segmento
    ? SEGMENTS.find((s) => s.id === entrada.segmento)
    : undefined;
  const categoria = entrada.categoria
    ? CATEGORIES.find((c) => c.id === entrada.categoria)
    : undefined;

  const candidatos = INDICE.filter(
    ({ tool }) => !categoria || tool.category === categoria.id,
  );

  const buscou = !!entrada.dor?.trim();
  const termos = buscou ? termosDe(entrada.dor as string) : [];

  // Sem texto nenhum é listagem: devolve o recorte do catálogo. Com texto que
  // não sobrou termo útil ("preciso de mais isso aqui") é busca vazia, e vazio
  // é a resposta honesta — seis ferramentas quaisquer fariam o modelo
  // recomendar ao acaso em vez de perguntar melhor.
  if (buscou && termos.length === 0) return [];

  if (termos.length === 0) {
    const base = segmento
      ? candidatos.filter(({ tool }) => segmento.tools.includes(tool.id))
      : candidatos;
    return base.slice(0, limite).map(({ tool }) => paraResultado(tool, []));
  }

  const pontuados = candidatos.map(({ tool, campos }) => {
    let pontos = 0;
    const motivo = new Set<string>();

    for (const termo of termos) {
      const reduzido = reduzir(termo);
      for (const campo of campos) {
        if (campo.texto.includes(termo) || campo.texto.includes(reduzido)) {
          pontos += campo.peso;
          motivo.add(campo.rotulo);
        }
      }
    }

    // O segmento é empurrão, não filtro: some meio ponto de dor para desempatar
    // a favor de quem já é do ramo, sem sumir com o resto.
    if (pontos > 0 && segmento?.tools.includes(tool.id)) {
      pontos += PESOS.dor / 2;
      motivo.add("segmento");
    }

    return { tool, pontos, motivo: [...motivo] };
  });

  const ordenados = pontuados
    .filter((item) => item.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos);

  // Piso de relevância. Sem ele a cauda longa entra junto — uma palavra em
  // comum basta para pontuar — e o modelo apresenta o que recebe: numa dor de
  // encarte, ele acabava oferecendo PDV e Forms "de brinde". O corte é
  // relativo ao melhor resultado, então uma busca certeira devolve poucas e
  // uma busca vaga devolve mais, que é o comportamento desejado nos dois casos.
  const piso = (ordenados[0]?.pontos ?? 0) * RELEVANCIA_MINIMA;

  return ordenados
    .filter((item) => item.pontos >= piso)
    .slice(0, limite)
    .map((item) => paraResultado(item.tool, item.motivo));
}

function paraResultado(tool: Tool, motivo: string[]): FerramentaEncontrada {
  return {
    id: tool.id,
    nome: tool.fullName,
    categoria: tool.category,
    tagline: tool.tagline,
    href: hrefForTool(tool.id),
    motivo,
  };
}

// ─── Detalhe sob demanda ──────────────────────────────────────────────────────

export type FerramentaDetalhada = {
  id: string;
  nome: string;
  categoria: CategoryId;
  tagline: string;
  resumo: string;
  funcionalidades: Array<{ titulo: string; texto: string }>;
  /** O par do site: o que passa a ter, e o que deixa de acontecer. */
  ganhos: string[];
  dores: string[];
  href: string | null;
};

/** Tudo o que se sabe de uma ferramenta. `null` quando o id não existe. */
export function detalharFerramenta(id: string): FerramentaDetalhada | null {
  const tool = findCatalogTool(id);
  if (!tool) return null;
  const comparacao = compareFor(tool.id);
  return {
    id: tool.id,
    nome: tool.fullName,
    categoria: tool.category,
    tagline: tool.tagline,
    resumo: tool.summary,
    funcionalidades: tool.features.map((f) => ({
      titulo: f.title,
      texto: f.description,
    })),
    ganhos: comparacao?.more ?? [],
    dores: comparacao?.less ?? [],
    href: hrefForTool(tool.id),
  };
}

export type SegmentoDetalhado = {
  id: string;
  nome: string;
  resumo: string;
  ferramentas: FerramentaEncontrada[];
};

/** Um segmento e as ferramentas curadas para ele, na ordem da página. */
export function detalharSegmento(id: string): SegmentoDetalhado | null {
  const segmento: Segment | undefined = SEGMENTS.find((s) => s.id === id);
  if (!segmento) return null;
  return {
    id: segmento.id,
    nome: segmento.name,
    resumo: segmento.summary,
    ferramentas: segmento.tools
      .map((toolId) => findCatalogTool(toolId))
      .filter((tool): tool is Tool => tool !== null && tool !== undefined)
      .map((tool) => paraResultado(tool, ["segmento"])),
  };
}

export type MetodoExplicado = {
  etapas: MetodoEtapa[];
  principio: string;
};

/**
 * O Método N.A.S.A., inteiro ou uma etapa.
 *
 * A etapa é escolhida pela POSIÇÃO (1 a 4), não pela letra: "A" é Análise e
 * também é Ação, e a ordem é o que as distingue. Aceita o nome também, porque
 * é o que o modelo tende a passar.
 */
export function explicarMetodo(etapa?: string | number): MetodoExplicado {
  if (etapa === undefined || etapa === null || etapa === "") {
    return { etapas: METODO_ETAPAS, principio: METODO_PRINCIPIO };
  }

  const porPosicao = Number(etapa);
  if (Number.isInteger(porPosicao) && porPosicao >= 1 && porPosicao <= 4) {
    return {
      etapas: [METODO_ETAPAS[porPosicao - 1]],
      principio: METODO_PRINCIPIO,
    };
  }

  const alvo = normalizar(String(etapa));
  const encontrada = METODO_ETAPAS.find(
    (item) => normalizar(item.title) === alvo,
  );
  return {
    etapas: encontrada ? [encontrada] : METODO_ETAPAS,
    principio: METODO_PRINCIPIO,
  };
}
