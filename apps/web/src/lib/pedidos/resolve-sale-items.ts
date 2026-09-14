import { resolveManyPrices } from "@/features/precos/server/resolve-price";
import prisma from "@/lib/db";

export type SaleItemRequest = {
  id: string;
  quantity: number;
  notes?: string | null;
};

export type ResolvedSaleItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  notes: string | null;
};

export type ResolveSaleItemsResult =
  | {
      ok: true;
      items: ResolvedSaleItem[];
      subtotal: number;
      priceListId: string | null;
    }
  | { ok: false; reason: "product-not-found" };

/**
 * Valida os produtos contra a organização e resolve o preço no SERVIDOR.
 *
 * O preço nunca vem do cliente: quem manda é `resolveManyPrices`, com a tabela
 * do `Customer` quando existe. Produto sem controle de estoque não é barrado
 * por `currentStock` — quem faz hambúrguer não conta pão no sistema.
 */
export async function resolveSaleItems({
  organizationId,
  customerId,
  products,
}: {
  organizationId: string;
  customerId: string | null;
  products: SaleItemRequest[];
}): Promise<ResolveSaleItemsResult> {
  const found = await prisma.product.findMany({
    where: {
      id: { in: products.map((p) => p.id) },
      organizationId,
      isActive: true,
      OR: [{ trackStock: false }, { currentStock: { gte: 1 } }],
    },
    select: { id: true, name: true },
  });

  if (found.length !== products.length)
    return { ok: false, reason: "product-not-found" };

  const byId = new Map(found.map((p) => [p.id, p]));

  const customer = customerId
    ? await prisma.customer.findFirst({
        where: { id: customerId, organizationId },
        select: { priceListId: true },
      })
    : null;

  const resolved = await resolveManyPrices({
    organizationId,
    priceListId: customer?.priceListId ?? null,
    items: products.map((p) => ({ productId: p.id, quantity: p.quantity })),
  });

  const items = products.map((requested, i) => {
    const product = byId.get(requested.id);
    if (!product)
      throw new Error(`Produto ${requested.id} sumiu entre a busca e o mapa`);
    const unitPrice = resolved[i].unitPrice;
    return {
      productId: product.id,
      productName: product.name,
      quantity: requested.quantity,
      unitPrice,
      total: unitPrice * requested.quantity,
      notes: requested.notes?.trim() || null,
    };
  });

  return {
    ok: true,
    items,
    subtotal: items.reduce((acc, item) => acc + item.total, 0),
    priceListId: resolved[0]?.priceListId ?? null,
  };
}

/**
 * Próximo número de venda, pelo contador atômico da organização.
 *
 * Existe para que ninguém derive número por `findFirst(orderBy: desc) + 1`: sob
 * duas vendas simultâneas isso colide com `@@unique([organizationId, saleNumber])`.
 */
export async function nextSaleNumber(organizationId: string): Promise<number> {
  const org = await prisma.organization.update({
    where: { id: organizationId },
    data: { lastSaleNumber: { increment: 1 } },
    select: { lastSaleNumber: true },
  });
  return org.lastSaleNumber;
}
