import type { ColorBy, ProductRef } from "./types";

// Cor DERIVADA no render, nunca persistida — mesmo princípio do
// `resolveObjectStyle` do store-map. "Exibir por Cores" é estado de
// visualização: gravar a cor no item significaria migrar dados toda vez que a
// paleta mudasse, e dois usuários não poderiam ver o mesmo planograma
// coloridos por critérios diferentes.

// Paleta de alto contraste entre vizinhos — o objetivo é distinguir blocos de
// marca na gôndola, não agradar esteticamente.
const PALETTE = [
  "#0ea5e9",
  "#c1121f",
  "#16a34a",
  "#f59e0b",
  "#7c3aed",
  "#db2777",
  "#0d9488",
  "#ea580c",
  "#4f46e5",
  "#65a30d",
  "#be123c",
  "#0891b2",
];

const NEUTRAL = "#94a3b8";

/** Hash estável: a mesma marca recebe a mesma cor entre sessões e telas. */
function hashToIndex(value: string, buckets: number): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % buckets;
}

export function resolveItemColor(
  product: ProductRef | undefined,
  colorBy: ColorBy,
): string {
  if (!product || colorBy === "NONE") return NEUTRAL;

  const key =
    colorBy === "BRAND"
      ? product.brandId
      : colorBy === "CATEGORY"
        ? product.categoryId
        : product.supplierId;

  if (!key) return NEUTRAL;
  return PALETTE[hashToIndex(key, PALETTE.length)];
}

/** Rótulo do bloco colorido — é o que o usuário lê no modo "Exibir por Cores". */
export function resolveItemLabel(
  product: ProductRef | undefined,
  colorBy: ColorBy,
): string {
  if (!product) return "—";
  if (colorBy === "BRAND") return product.brandName ?? "Sem marca";
  return product.name;
}

/**
 * O snapshot do item pode divergir do cadastro se alguém corrigir a medida do
 * SKU depois. Não corrigimos sozinho — um planograma aprovado e impresso não
 * pode mudar sem alguém mandar. Só sinalizamos.
 */
export function hasStaleDimensions(
  item: { widthMm: number; heightMm: number; depthMm: number },
  product: ProductRef | undefined,
): boolean {
  if (!product) return false;
  if (product.widthMm == null || product.heightMm == null) return false;
  return (
    product.widthMm !== item.widthMm ||
    product.heightMm !== item.heightMm ||
    (product.depthMm != null && product.depthMm !== item.depthMm)
  );
}
