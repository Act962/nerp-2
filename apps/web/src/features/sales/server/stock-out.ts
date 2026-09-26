import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

export type StockOutProduct = {
  currentStock: unknown;
  trackStock: boolean;
};

export type ApplySaleStockOutArgs = {
  organizationId: string;
  saleId: string;
  createdById: string;
  items: ReadonlyArray<{ productId: string; quantity: number }>;
  productById: ReadonlyMap<string, StockOutProduct>;
};

/**
 * Baixa de estoque de uma venda + movimento `VENDA` de auditoria, só para os
 * produtos que controlam estoque. Um lugar só para o PDV e para a confirmação
 * de pedido vinda do Órbita não divergirem sobre o que é "vender".
 */
export async function applySaleStockOut(
  tx: Tx,
  args: ApplySaleStockOutArgs,
): Promise<void> {
  for (const item of args.items) {
    const product = args.productById.get(item.productId);
    if (!product || !product.trackStock) continue;
    const previousStock = Number(product.currentStock);
    const newStock = previousStock - item.quantity;
    await tx.stockMovement.create({
      data: {
        organizationId: args.organizationId,
        productId: item.productId,
        type: "VENDA",
        quantity: item.quantity,
        previousStock,
        newStock,
        saleId: args.saleId,
        createdById: args.createdById,
      },
    });
    await tx.product.update({
      where: { id: item.productId },
      data: { currentStock: newStock },
    });
  }
}
