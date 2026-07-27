import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Rupturas por loja: overrides StoreProduct com estoque abaixo do mínimo. Usa o
// estoque por-loja (Fase C); produtos sem override não entram (não há estoque
// por loja pra comparar).
export const ruptureTasks = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ storeId: z.string() }))
  .handler(async ({ input, context }) => {
    const rows = await prisma.storeProduct.findMany({
      where: {
        organizationId: context.org.id,
        storeId: input.storeId,
        currentStock: { not: null },
        minStock: { not: null },
      },
      select: {
        currentStock: true,
        minStock: true,
        product: { select: { name: true, barcode: true } },
      },
    });

    return rows
      .filter((row) => Number(row.currentStock) < Number(row.minStock))
      .map((row) => ({
        productName: row.product.name,
        barcode: row.product.barcode,
        currentStock: Number(row.currentStock),
        minStock: Number(row.minStock),
      }));
  });

// Liquidação por validade: grava o preço promocional POR LOJA (StoreProduct).
// Aparece direto no lookup do app do cliente, sem código novo do lado dele.
export const setClearance = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      storeId: z.string(),
      barcode: z.string().min(1),
      promotionalPrice: z.number().positive(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const store = await prisma.store.findFirst({
      where: { id: input.storeId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!store) throw errors.NOT_FOUND({ message: "Loja não encontrada" });

    const product = await prisma.product.findFirst({
      where: { organizationId: context.org.id, barcode: input.barcode.trim() },
      select: { id: true },
    });
    if (!product) throw errors.NOT_FOUND({ message: "Produto não encontrado" });

    await prisma.storeProduct.upsert({
      where: {
        storeId_productId: { storeId: store.id, productId: product.id },
      },
      create: {
        organizationId: context.org.id,
        storeId: store.id,
        productId: product.id,
        promotionalPrice: input.promotionalPrice,
      },
      update: { promotionalPrice: input.promotionalPrice },
    });

    return { ok: true };
  });
