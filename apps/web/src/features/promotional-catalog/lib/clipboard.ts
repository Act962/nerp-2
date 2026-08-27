import type {
  CatalogPage,
  LayerSelection,
  Overlay,
  ProductGroup,
  StyleBlock,
  TextElement,
} from "../types";

// Copiar/colar de elementos entre páginas — lógica PURA (sem React).
//
// Mora fora do editor porque o risco não é a interface: colar um grupo mexe em
// `productIds` de página, e fixar isso numa página liga o modo explícito do
// catálogo inteiro. Errar aqui embaralha os produtos de TODAS as páginas, então
// a regra precisa ser testável sem montar o editor.

/** Item da seleção múltipla (Shift+clique) espelhado da camada de seleção. */
export type ExtraSelection = { kind: "overlay" | "text" | "block"; id: string };

export type ClipboardData = {
  // Página de origem — só para saber se o "colar" é na mesma página.
  fromPageId: string;
  overlays: Overlay[];
  texts: TextElement[];
  styleBlocks: StyleBlock[];
  groups: ProductGroup[];
};

/**
 * Monta o conteúdo copiado a partir da seleção.
 *
 * Guarda os OBJETOS, não os ids: colar depois de mexer no original tem que dar
 * o que foi copiado, não o estado novo.
 */
export function collectClipboard(
  page: CatalogPage,
  selection: LayerSelection,
  extra: readonly ExtraSelection[],
): ClipboardData | null {
  if (!selection) return null;

  const marcados = new Set(extra.map((x) => `${x.kind}:${x.id}`));
  if (selection.kind === "element") marcados.add(`overlay:${selection.id}`);
  if (selection.kind === "text") marcados.add(`text:${selection.id}`);
  if (selection.kind === "styleBlock") marcados.add(`block:${selection.id}`);

  // Cópia rasa de cada item: `filter` sozinho guardaria a MESMA referência, e
  // aí editar o original depois de copiar mudaria o que seria colado.
  const data: ClipboardData = {
    fromPageId: page.id,
    overlays: (page.overlays ?? [])
      .filter((o) => marcados.has(`overlay:${o.id}`))
      .map((o) => ({ ...o })),
    texts: (page.texts ?? [])
      .filter((t) => marcados.has(`text:${t.id}`))
      .map((t) => ({ ...t })),
    styleBlocks: (page.styleBlocks ?? [])
      .filter((b) => marcados.has(`block:${b.id}`))
      .map((b) => ({ ...b })),
    groups:
      selection.kind === "group" && selection.id
        ? (page.productGroups ?? [])
            .filter((g) => g.id === selection.id)
            .map((g) => ({
              ...g,
              rect: { ...g.rect },
              // Sem o espalhamento condicional, um grupo SEM `productIds`
              // ganharia a chave com `undefined` — e o render trata
              // "chave ausente" e "undefined" de formas diferentes.
              ...(g.productIds ? { productIds: [...g.productIds] } : {}),
            }))
        : [],
  };

  return countClipboard(data) > 0 ? data : null;
}

export function countClipboard(data: ClipboardData): number {
  return (
    data.overlays.length +
    data.texts.length +
    data.styleBlocks.length +
    data.groups.length
  );
}

export type PasteParams = {
  pages: readonly CatalogPage[];
  index: number;
  data: ClipboardData;
  // `pageChunks[i].map(p => p.id)` — a distribuição que está na tela agora.
  frozenProductIds: readonly string[][];
  // Injetado para o módulo continuar puro (e o teste, determinístico).
  newId: () => string;
  // Deslocamento aplicado ao colar na MESMA página.
  offset?: number;
};

export type PasteResult = {
  pages: CatalogPage[];
  /** Produtos que entraram na página junto com um grupo colado. */
  pastedProductIds: string[];
};

/**
 * Cola na página `index`, sempre com ids NOVOS.
 *
 * Id novo é obrigatório: dois elementos de mesmo id em páginas diferentes fazem
 * a camada de seleção editar o errado — foi exatamente o que aconteceu com os
 * grupos em `duplicatePage`.
 */
export function pasteIntoPage({
  pages,
  index,
  data,
  frozenProductIds,
  newId,
  offset = 0,
}: PasteParams): PasteResult {
  const alvo = pages[index];
  if (!alvo) return { pages: [...pages], pastedProductIds: [] };

  // Colar na MESMA página desloca; em outra, mantém a posição — é o que faz o
  // elemento cair no mesmo lugar em todas as páginas.
  const d = alvo.id === data.fromPageId ? offset : 0;

  const novosGrupos = data.groups.map((g) => ({
    ...g,
    id: newId(),
    rect: { ...g.rect, x: g.rect.x + d, y: g.rect.y + d },
  }));
  const pastedProductIds = [
    ...new Set(novosGrupos.flatMap((g) => g.productIds ?? [])),
  ];

  // Congela a distribuição atual ANTES de mexer: fixar `productIds` numa página
  // liga o modo explícito do catálogo inteiro, e sem congelar as outras os
  // produtos delas pulariam de página.
  let out: CatalogPage[] =
    pastedProductIds.length > 0
      ? pages.map((pg, k) =>
          pg.productIds !== undefined
            ? { ...pg }
            : { ...pg, productIds: [...(frozenProductIds[k] ?? [])] },
        )
      : [...pages];

  out = out.map((pg, k) =>
    k !== index
      ? pg
      : {
          ...pg,
          overlays: [
            ...(pg.overlays ?? []),
            ...data.overlays.map((o) => ({
              ...o,
              id: newId(),
              x: o.x + d,
              y: o.y + d,
            })),
          ],
          texts: [
            ...(pg.texts ?? []),
            ...data.texts.map((t) => ({
              ...t,
              id: newId(),
              x: t.x + d,
              y: t.y + d,
            })),
          ],
          styleBlocks: [
            ...(pg.styleBlocks ?? []),
            ...data.styleBlocks.map((b) => ({
              ...b,
              id: newId(),
              x: b.x + d,
              y: b.y + d,
            })),
          ],
          ...(novosGrupos.length > 0
            ? {
                productGroups: [...(pg.productGroups ?? []), ...novosGrupos],
                // O grupo colado desenharia vazio se os produtos dele não
                // estivessem também na página.
                productIds: [
                  ...new Set([...(pg.productIds ?? []), ...pastedProductIds]),
                ],
              }
            : {}),
        },
  );

  return { pages: out, pastedProductIds };
}
