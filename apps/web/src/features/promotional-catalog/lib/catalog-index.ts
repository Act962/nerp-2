import type { CatalogIndexMode, CatalogPage } from "../types";
import { normalizeName } from "./product-match";

// Monta o SUMÁRIO do catálogo: o que está em qual página.
//
// Módulo PURO (sem React, sem DOM): o mesmo cálculo serve o editor, o link
// público e o PDF. Se cada um montasse o seu, os números divergiriam — e um
// índice que aponta para a página errada é pior que não ter índice.

/** Uma linha do índice: o rótulo e as páginas em que ele aparece. */
export type IndexRow = {
  label: string;
  /** Números 1-based, na contagem que o LEITOR vê (inclui as de índice). */
  pages: number[];
};

/** O que o índice precisa saber de cada página, na ordem do catálogo. */
export type IndexSourcePage = {
  name?: string;
  kind?: "index";
  products: readonly {
    id: string;
    name: string;
    categoryName?: string | null;
  }[];
};

const SEM_CATEGORIA = "Sem categoria";

/** O nome da página diz algo, ou é só "Página 3"? */
export function pageNameIsGeneric(nome: string | undefined): boolean {
  const limpo = nome?.trim();
  return !limpo || /^p[áa]gina\s*\d+$/i.test(limpo);
}

/**
 * Rótulo de uma página. Nome genérico ("Página 3") não vira rótulo: numa lista
 * em que a outra coluna já é o número, "Página 3 …… 3" não diz nada.
 *
 * Compartilhado com o buscador do link público — a regra do que é "nome
 * genérico" tem que ser a MESMA nos dois, senão o índice e a busca chamariam a
 * mesma página por nomes diferentes.
 */
export function nomeDaPagina(nome: string | undefined, numero: number): string {
  return pageNameIsGeneric(nome) ? `Página ${numero}` : (nome as string).trim();
}

/** Agrupa por chave normalizada preservando o primeiro rótulo visto. */
function agrupar(
  entradas: { chave: string; label: string; pagina: number }[],
): IndexRow[] {
  const mapa = new Map<string, { label: string; pages: Set<number> }>();
  for (const e of entradas) {
    const atual = mapa.get(e.chave);
    if (atual) atual.pages.add(e.pagina);
    else mapa.set(e.chave, { label: e.label, pages: new Set([e.pagina]) });
  }
  return [...mapa.values()]
    .map((v) => ({ label: v.label, pages: [...v.pages].sort((a, b) => a - b) }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

export function buildCatalogIndex(
  pages: readonly IndexSourcePage[],
  mode: CatalogIndexMode,
): IndexRow[] {
  if (mode === "page") {
    // Ordem do documento, não alfabética: aqui o índice é a própria sequência
    // do encarte, e reordenar destruiria a única coisa que ele informa.
    return pages.flatMap((pg, i) =>
      pg.kind === "index"
        ? []
        : [{ label: nomeDaPagina(pg.name, i + 1), pages: [i + 1] }],
    );
  }

  const entradas: { chave: string; label: string; pagina: number }[] = [];
  pages.forEach((pg, i) => {
    if (pg.kind === "index") return;
    for (const p of pg.products) {
      if (mode === "category") {
        const label = p.categoryName?.trim() || SEM_CATEGORIA;
        entradas.push({ chave: normalizeName(label), label, pagina: i + 1 });
      } else {
        const label = p.name.trim();
        if (!label) continue;
        // Chave normalizada: o mesmo produto escrito com acento diferente em
        // páginas diferentes vira UMA linha, não duas.
        entradas.push({ chave: normalizeName(label), label, pagina: i + 1 });
      }
    }
  });
  return agrupar(entradas);
}

/**
 * Fatia as linhas entre as páginas de índice existentes.
 *
 * O índice pode não caber numa página só — 222 páginas geram 222 linhas no modo
 * "página". Cada página de índice mostra a sua fatia; a ÚLTIMA leva o resto,
 * para nenhuma linha sumir silenciosamente quando faltar página.
 */
export function sliceIndexRows(
  rows: readonly IndexRow[],
  ordinal: number,
  totalIndexPages: number,
  rowsPerPage: number,
): IndexRow[] {
  if (totalIndexPages <= 0 || rowsPerPage <= 0) return [];
  const inicio = ordinal * rowsPerPage;
  if (inicio >= rows.length) return [];
  const ultima = ordinal === totalIndexPages - 1;
  return ultima
    ? [...rows.slice(inicio)]
    : [...rows.slice(inicio, inicio + rowsPerPage)];
}

/** Quantas páginas de índice as linhas exigem, dado o que cabe em cada uma. */
export function indexPagesNeeded(
  rowCount: number,
  rowsPerPage: number,
): number {
  if (rowsPerPage <= 0) return 1;
  return Math.max(1, Math.ceil(rowCount / rowsPerPage));
}

/** Altura da linha do índice, derivada do tamanho da fonte. */
export function indexLineHeight(fontSize: number): number {
  return Math.max(12, Math.round(fontSize * 1.73));
}

/** Tamanho de fonte padrão do índice. */
export const INDEX_FONT_SIZE = 15;

/**
 * Quantas linhas cabem numa página de índice.
 *
 * Conservador de propósito: a página tem altura fixa e o que passar é CORTADO,
 * então é melhor sobrar espaço do que perder linha. Os 220 px descontados
 * cobrem paddings, título e rodapé.
 *
 * Acompanha o tamanho da fonte: diminuir a letra tem que fazer caber mais
 * linhas, senão reduzir o texto só deixaria espaço vazio no pé da página.
 */
export function rowsPerIndexPage(
  pageHeight: number,
  columns = 2,
  fontSize = INDEX_FONT_SIZE,
): number {
  const util = Math.max(0, pageHeight - 220);
  return Math.max(1, Math.floor(util / indexLineHeight(fontSize)) * columns);
}

/** Duas colunas na maioria dos casos; uma só quando há pouca coisa a listar. */
export function indexColumns(rowCount: number): number {
  return rowCount > 14 ? 2 : 1;
}

/**
 * Linhas do índice já fatiadas, POR PÁGINA do catálogo.
 *
 * Um único ponto de cálculo para o editor, o link público e o export — se cada
 * um montasse o seu, os números divergiriam e o índice apontaria para a página
 * errada em algum dos três.
 *
 * Páginas de índice com o MESMO modo formam uma sequência e repartem as linhas
 * entre si; modos diferentes são listas independentes (dá para ter um índice
 * por cliente e outro por produto no mesmo catálogo).
 *
 * Devolve `undefined` nas páginas comuns.
 */
export function indexRowsForPages(
  pages: readonly CatalogPage[],
  chunks: readonly (readonly {
    id: string;
    name: string;
    categoryName?: string | null;
  }[])[],
  pageHeight: number,
): (IndexRow[] | undefined)[] {
  const saida: (IndexRow[] | undefined)[] = pages.map(() => undefined);
  const porModo = new Map<CatalogIndexMode, number[]>();
  pages.forEach((pg, i) => {
    if (pg.kind !== "index") return;
    const modo = pg.indexMode ?? "product";
    const atual = porModo.get(modo);
    if (atual) atual.push(i);
    else porModo.set(modo, [i]);
  });
  if (porModo.size === 0) return saida;

  const fonte: IndexSourcePage[] = pages.map((pg, i) => ({
    name: pg.name,
    kind: pg.kind,
    products: chunks[i] ?? [],
  }));

  for (const [modo, posicoes] of porModo) {
    const rows = buildCatalogIndex(fonte, modo);
    // Estilo da PRIMEIRA página do grupo: as páginas de um mesmo índice
    // repartem as linhas, então precisam concordar sobre quantas cabem.
    const estilo = pages[posicoes[0]]?.indexStyle;
    const porPagina = rowsPerIndexPage(
      pageHeight,
      estilo?.columns ?? indexColumns(rows.length),
      estilo?.fontSize,
    );
    posicoes.forEach((pagina, ordinal) => {
      saida[pagina] = sliceIndexRows(rows, ordinal, posicoes.length, porPagina);
    });
  }
  return saida;
}
