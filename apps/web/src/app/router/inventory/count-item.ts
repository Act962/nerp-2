import prisma from "@/lib/db";
import { z } from "zod";
import { p } from "./_shared";

// Registra (ou corrige) a contagem de um produto na sessão.
//
// O saldo do sistema é CONGELADO aqui, no instante da contagem. Recontar o
// mesmo produto atualiza a linha e recongela — é observação nova, não uma
// segunda contagem competindo com a primeira.
export const countInventoryItem = p
  .input(
    z.object({
      countId: z.string(),
      productId: z.string(),
      countedQuantity: z.number().min(0),
    }),
  )
  .output(
    z.object({
      countedQuantity: z.number(),
      systemQuantity: z.number(),
      /** Só volta preenchido quando a contagem NÃO é cega. */
      divergence: z.number().nullable(),
      blind: z.boolean(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const [count, product] = await Promise.all([
      prisma.inventoryCount.findFirst({
        where: { id: input.countId, organizationId: context.org.id },
        select: { id: true, status: true, blind: true },
      }),
      prisma.product.findFirst({
        where: { id: input.productId, organizationId: context.org.id },
        select: { id: true, currentStock: true },
      }),
    ]);

    if (!count) throw errors.NOT_FOUND({ message: "Contagem não encontrada" });
    if (count.status !== "OPEN") {
      throw errors.BAD_REQUEST({
        message: "Esta contagem já foi encerrada",
      });
    }
    if (!product) throw errors.NOT_FOUND({ message: "Produto não encontrado" });

    const systemQuantity = product.currentStock.toNumber();

    await prisma.inventoryCountItem.upsert({
      where: {
        countId_productId: { countId: count.id, productId: product.id },
      },
      create: {
        organizationId: context.org.id,
        countId: count.id,
        productId: product.id,
        countedQuantity: input.countedQuantity,
        systemQuantity,
        countedById: context.user.id,
      },
      update: {
        countedQuantity: input.countedQuantity,
        systemQuantity,
        countedById: context.user.id,
        countedAt: new Date(),
      },
      select: { id: true },
    });

    return {
      countedQuantity: input.countedQuantity,
      systemQuantity,
      // Cega: devolver a divergência aqui entregaria o saldo de bandeja e
      // anularia justamente o motivo de ser cega.
      divergence: count.blind ? null : input.countedQuantity - systemQuantity,
      blind: count.blind,
    };
  });
