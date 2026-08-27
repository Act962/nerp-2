import type { ProductGroup } from "../types";

// Quem está em qual GRUPO DE PRODUTOS de uma página — fonte única.
//
// A regra vivia só dentro do render (`catalog-preview.tsx`), e a lateral da aba
// "Página" usava um critério próprio (só o `productIds` explícito). As duas
// discordavam justamente no caso mais comum: um produto recém-adicionado é
// desenhado DENTRO do último grupo, mas a lateral não o mostrava ali.

/**
 * Distribui os produtos entre os grupos, na mesma ordem em que o canvas desenha.
 *
 * - Grupo NOMEADO (`productIds` definido) mostra os SEUS produtos, por
 *   pertencimento — é o que faz um produto "sair" do Grupo 1 ao entrar no 2.
 * - Grupo de CAPACIDADE (sem `productIds`) recebe uma fatia sequencial dos não
 *   agrupados, do tamanho de colunas × linhas.
 * - O ÚLTIMO grupo recolhe qualquer sobra, para nenhum produto sumir da página.
 *   É por isso que um produto novo aparece no último grupo sem estar no
 *   `productIds` dele.
 */
export function sliceProductsByGroup<T extends { id: string }>(
  groups: readonly ProductGroup[],
  products: readonly T[],
): T[][] {
  const namedIds = new Set(groups.flatMap((g) => g.productIds ?? []));
  const ungrouped = products.filter((p) => !namedIds.has(p.id));
  let capIdx = 0;
  return groups.map((g, gi) => {
    const isLast = gi === groups.length - 1;
    if (g.productIds && g.productIds.length > 0) {
      const set = new Set(g.productIds);
      const own = products.filter((p) => set.has(p.id));
      return isLast ? [...own, ...ungrouped] : own;
    }
    const cap = Math.max(1, g.gridCols) * Math.max(1, g.gridRows);
    const slice = isLast
      ? ungrouped.slice(capIdx)
      : ungrouped.slice(capIdx, capIdx + cap);
    capIdx += cap;
    return slice;
  });
}

/**
 * Índice inverso: produto → id do grupo que o exibe. Usado pela lateral para
 * agrupar a lista sem repetir a regra acima.
 */
export function groupIdByProduct<T extends { id: string }>(
  groups: readonly ProductGroup[],
  products: readonly T[],
): Map<string, string> {
  const out = new Map<string, string>();
  const slices = sliceProductsByGroup(groups, products);
  slices.forEach((slice, i) => {
    for (const p of slice) out.set(p.id, groups[i].id);
  });
  return out;
}

/**
 * Grupo que ADOTA um produto recém-adicionado à página.
 *
 * É o último — a mesma regra de sobra que o canvas já aplica, então gravar o
 * pertencimento não muda nada no desenho: só torna explícito o que já era
 * exibido. Sem isso, criar um grupo novo mais tarde faria o produto "pular"
 * para ele, porque a sobra passa a ser recolhida pelo novo último grupo.
 *
 * Devolve `null` quando não há grupo nomeado para assumir: um grupo de
 * CAPACIDADE (sem `productIds`) viraria nomeado ao receber um id, mudando o
 * comportamento dele sem o usuário ter pedido.
 */
export function groupToAdoptNewProduct(
  groups: readonly ProductGroup[],
): ProductGroup | null {
  const last = groups[groups.length - 1];
  return last && last.productIds !== undefined ? last : null;
}

/** Insere o produto no grupo que o adotaria. Sem grupo elegível, devolve `null`. */
export function withProductAdopted(
  groups: readonly ProductGroup[],
  productId: string,
): ProductGroup[] | null {
  const adopt = groupToAdoptNewProduct(groups);
  if (!adopt) return null;
  if (adopt.productIds?.includes(productId)) return null;
  return groups.map((g) =>
    g.id === adopt.id
      ? { ...g, productIds: [...(g.productIds ?? []), productId] }
      : g,
  );
}

/** Nome livre para uma cópia: "Hortifruti (2)", "(3)"… sem colidir. */
export function nextCopyName(
  groups: readonly ProductGroup[],
  baseName: string,
): string {
  const taken = new Set(groups.map((g) => g.name).filter(Boolean));
  // Duplicar uma cópia parte do nome ORIGINAL: "Hortifruti (2)" gera
  // "Hortifruti (3)", não "Hortifruti (2) (2)".
  const raiz = baseName.replace(/\s*\(\d+\)$/, "");
  for (let n = 2; n < 999; n++) {
    const tentativa = `${raiz} (${n})`;
    if (!taken.has(tentativa)) return tentativa;
  }
  return `${raiz} (cópia)`;
}

/**
 * Tira os produtos de TODOS os outros grupos. É o que faz a maçã sair do
 * "Grupo Geral" ao entrar no "Hortifruti" — sem isso ela ficaria nos dois e
 * apareceria duas vezes na página.
 */
export function removeFromOtherGroups(
  groups: readonly ProductGroup[],
  productIds: readonly string[],
  exceptGroupId: string,
): ProductGroup[] {
  const remover = new Set(productIds);
  return groups.map((g) =>
    g.id === exceptGroupId || g.productIds === undefined
      ? g
      : { ...g, productIds: g.productIds.filter((id) => !remover.has(id)) },
  );
}

/**
 * O "Grupo Geral": grupo padrão criado quando se adiciona produto a uma página
 * que ainda não tem grupo nenhum, para nenhum produto ficar solto.
 *
 * A região herda a do grupo único da página (`productGroup`) quando existe; sem
 * ela, deriva das margens da página, que é o mais perto do fluxo em grade que a
 * página usava antes.
 */
export function buildGeneralGroup(params: {
  productIds: string[];
  gridCols: number;
  gridRows: number;
  region?: { x: number; y: number; w: number; h: number };
  pageWidth: number;
  padding: { top: number; right: number; bottom: number; left: number };
  pageHeight: number;
  name?: string;
}): ProductGroup {
  const { region, padding, pageWidth, pageHeight } = params;
  const rect = region ?? {
    x: padding.left,
    y: padding.top,
    w: Math.max(1, pageWidth - padding.left - padding.right),
    h: Math.max(1, pageHeight - padding.top - padding.bottom),
  };
  return {
    id: crypto.randomUUID(),
    name: params.name ?? "Grupo Geral",
    productIds: params.productIds,
    rect,
    gridCols: Math.max(1, params.gridCols),
    gridRows: Math.max(1, params.gridRows),
  };
}
