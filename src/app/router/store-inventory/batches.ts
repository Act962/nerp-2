import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

async function assertStore(organizationId: string, storeId: string) {
  return prisma.store.findFirst({
    where: { id: storeId, organizationId },
    select: { id: true },
  });
}

// Registra um lote com validade (por código de barras) numa loja.
export const upsertBatch = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      storeId: z.string(),
      barcode: z.string().min(1),
      lote: z.string().max(60).optional(),
      validade: z.string(),
      quantity: z.number().positive(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const store = await assertStore(context.org.id, input.storeId);
    if (!store) throw errors.NOT_FOUND({ message: "Loja não encontrada" });

    const product = await prisma.product.findFirst({
      where: { organizationId: context.org.id, barcode: input.barcode.trim() },
      select: { id: true },
    });
    if (!product) throw errors.NOT_FOUND({ message: "Produto não encontrado" });

    const batch = await prisma.productBatch.create({
      data: {
        organizationId: context.org.id,
        storeId: store.id,
        productId: product.id,
        lote: input.lote || null,
        validade: new Date(input.validade),
        quantity: input.quantity,
      },
      select: { id: true },
    });
    return { id: batch.id };
  });

// Lotes da loja (próximos primeiro) com dias para vencer e flag de vencido.
export const listBatches = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ storeId: z.string() }))
  .handler(async ({ input, context }) => {
    const now = new Date();
    const batches = await prisma.productBatch.findMany({
      where: {
        organizationId: context.org.id,
        storeId: input.storeId,
        status: { not: "CLEARED" },
      },
      orderBy: { validade: "asc" },
      take: 200,
      select: {
        id: true,
        lote: true,
        validade: true,
        quantity: true,
        product: { select: { name: true, barcode: true } },
      },
    });

    const msPerDay = 1000 * 60 * 60 * 24;
    return batches.map((batch) => {
      const validade = batch.validade;
      const daysToExpiry = Math.ceil(
        (validade.getTime() - now.getTime()) / msPerDay,
      );
      return {
        id: batch.id,
        productName: batch.product.name,
        barcode: batch.product.barcode,
        lote: batch.lote,
        validade: validade.toISOString(),
        quantity: Number(batch.quantity),
        daysToExpiry,
        expired: daysToExpiry < 0,
      };
    });
  });
