import {
  lineTotal,
  purchaseTotals,
} from "@/features/purchases/lib/purchase-totals";
import prisma from "@/lib/db";
import { z } from "zod";

/**
 * Uma linha da nota. `discount` é em REAIS sobre a LINHA INTEIRA, não por
 * unidade — a mesma semântica de `Purchase.discount`/`shipping` e do `vDesc`
 * por item da NF-e. A aritmética vive em `features/purchases/lib/purchase-totals.ts`.
 */
export const purchaseItemInput = z.object({
  productId: z.string().min(1),
  quantity: z.number().positive("Quantidade deve ser maior que zero"),
  unitPrice: z.number().min(0),
  discount: z.number().min(0).default(0),
  /** Preço de venda aceito pelo operador. `null` = não mexer no preço. */
  newSalePrice: z.number().positive().nullable().default(null),
});

export const purchaseInput = z.object({
  supplierId: z.string().nullable().default(null),
  invoiceNumber: z.string().nullable().default(null),
  /** ISO. Ausente = agora. */
  orderDate: z.string().nullable().default(null),
  shipping: z.number().min(0).default(0),
  discount: z.number().min(0).default(0),
  installments: z.number().int().min(1).max(360).default(1),
  /** ISO. Ausente = a 1ª parcela vence no processamento. */
  firstDueDate: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
  // Teto para a transação do processamento não estourar o tempo: uma nota de
  // 200 linhas já faz ~400 idas ao banco.
  items: z.array(purchaseItemInput).max(200).default([]),
});

export type PurchaseInput = z.infer<typeof purchaseInput>;
export type PurchaseItemInput = z.infer<typeof purchaseItemInput>;

/** ISO → Date, tratando string vazia e data inválida como ausência. */
export function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export interface ProductRow {
  id: string;
  name: string;
  trackStock: boolean;
}

/**
 * Revalida contra a organização todo id que chegou de fora.
 *
 * Vale mesmo para id que já estava persistido no rascunho: o escopo por
 * organização é manual em cada handler, e um `findUnique` por id sem o filtro
 * movimentaria estoque de outro inquilino.
 */
export async function loadProductsInOrg(
  organizationId: string,
  productIds: string[],
): Promise<Map<string, ProductRow> | null> {
  const unique = [...new Set(productIds)];
  if (unique.length === 0) return new Map();

  const products = await prisma.product.findMany({
    where: { id: { in: unique }, organizationId },
    select: { id: true, name: true, trackStock: true },
  });
  if (products.length !== unique.length) return null;

  return new Map(products.map((product) => [product.id, product]));
}

export async function supplierBelongsToOrg(
  organizationId: string,
  supplierId: string,
): Promise<boolean> {
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, organizationId },
    select: { id: true },
  });
  return supplier !== null;
}

/**
 * Linhas prontas para gravar. `productName` é snapshot: renomear o produto
 * depois não pode reescrever o que a nota dizia. `sortOrder` vem do índice, que
 * é a ordem em que o operador digitou — e é o que torna determinístico qual
 * linha é a "última" quando o mesmo produto aparece duas vezes.
 */
export function purchaseItemRows(
  input: PurchaseInput,
  products: Map<string, ProductRow>,
) {
  return input.items.map((item, index) => ({
    productId: item.productId,
    productName: products.get(item.productId)?.name ?? "",
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    discount: item.discount,
    total: lineTotal(item),
    newSalePrice: item.newSalePrice,
    sortOrder: index,
  }));
}

/**
 * Cabeçalho pronto para gravar, com os totais calculados NO SERVIDOR — o que o
 * cliente manda de subtotal/total nunca é gravado.
 */
export function purchaseHeaderData(input: PurchaseInput) {
  const totals = purchaseTotals(input);
  return {
    supplierId: input.supplierId,
    invoiceNumber: input.invoiceNumber,
    subtotal: totals.subtotal,
    // Descontos de linha + de cabeçalho, para o documento fechar sozinho.
    discount: totals.totalDiscount,
    shipping: input.shipping,
    total: totals.total,
    orderDate: parseDate(input.orderDate) ?? new Date(),
    installments: input.installments,
    firstDueDate: parseDate(input.firstDueDate),
    notes: input.notes,
  };
}
