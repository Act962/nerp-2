import type { Prisma } from "@/generated/prisma/client";

/**
 * Lacunas de cadastro que o painel de Produtos conta e a lista filtra.
 *
 * A definição vive num lugar só de propósito: se o card contasse por um
 * critério e a lista filtrasse por outro, o usuário clicaria em "12 sem SKU" e
 * receberia 9 itens — e passaria a desconfiar do painel inteiro.
 */
export const MISSING_FIELDS = [
  "category",
  "stock",
  "price",
  "sku",
  "barcode",
  "image",
] as const;

export type MissingField = (typeof MISSING_FIELDS)[number];

export const MISSING_LABEL: Record<MissingField, string> = {
  category: "Sem categoria",
  stock: "Sem estoque",
  price: "Sem preço",
  sku: "Sem SKU",
  barcode: "Sem código de barras",
  image: "Sem imagem",
};

/** Texto vazio conta como ausente: no cadastro em massa vem "" e não `null`. */
function vazio(campo: "sku" | "barcode"): Prisma.ProductWhereInput {
  return { OR: [{ [campo]: null }, { [campo]: "" }] };
}

export function missingWhere(field: MissingField): Prisma.ProductWhereInput {
  switch (field) {
    case "category":
      return { categoryId: null };
    // Decimal não é nullable: "sem" aqui significa zerado ou negativo.
    case "stock":
      return { currentStock: { lte: 0 } };
    case "price":
      return { salePrice: { lte: 0 } };
    case "sku":
      return vazio("sku");
    case "barcode":
      return vazio("barcode");
    // Só é "sem imagem" quem não tem NEM miniatura NEM galeria — ter uma das
    // duas já rende foto na tela.
    case "image":
      return { thumbnail: "", images: { isEmpty: true } };
  }
}
