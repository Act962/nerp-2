import {
  buildAdjustmentPlan,
  summarizeCount,
} from "@/features/stock/lib/inventory-count";
import prisma from "@/lib/db";
import { z } from "zod";
import { p } from "./_shared";

// Sessão com as linhas contadas, a divergência e o plano de ajuste.
//
// O saldo do sistema e a divergência só saem quando a contagem NÃO é cega, ou
// quando ela já foi encerrada — aí a conferência é justamente o objetivo.
export const getInventoryCount = p
  .input(z.object({ id: z.string() }))
  .output(
    z.object({
      count: z.object({
        id: z.string(),
        name: z.string(),
        status: z.enum(["OPEN", "APPLIED", "CANCELLED"]),
        blind: z.boolean(),
        notes: z.string().nullable(),
        startedAt: z.string(),
        appliedAt: z.string().nullable(),
      }),
      items: z.array(
        z.object({
          productId: z.string(),
          productName: z.string(),
          countedQuantity: z.number(),
          systemQuantity: z.number().nullable(),
          divergence: z.number().nullable(),
          currentStock: z.number().nullable(),
          driftedSinceCount: z.boolean(),
          countedAt: z.string(),
        }),
      ),
      summary: z
        .object({
          counted: z.number(),
          divergent: z.number(),
          positive: z.number(),
          negative: z.number(),
          netUnits: z.number(),
          drifted: z.number(),
        })
        .nullable(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const count = await prisma.inventoryCount.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: {
        id: true,
        name: true,
        status: true,
        blind: true,
        notes: true,
        startedAt: true,
        appliedAt: true,
        items: {
          select: {
            productId: true,
            countedQuantity: true,
            systemQuantity: true,
            countedAt: true,
            product: { select: { name: true, currentStock: true } },
          },
          orderBy: { countedAt: "desc" },
        },
      },
    });
    if (!count) throw errors.NOT_FOUND({ message: "Contagem não encontrada" });

    const lines = count.items.map((item) => ({
      productId: item.productId,
      productName: item.product.name,
      countedQuantity: item.countedQuantity.toNumber(),
      systemQuantity: item.systemQuantity.toNumber(),
      currentStock: item.product.currentStock.toNumber(),
      countedAt: item.countedAt.toISOString(),
    }));

    // Enquanto está aberta E cega, os números do sistema ficam escondidos.
    const reveal = !count.blind || count.status !== "OPEN";
    const planByProduct = new Map(
      buildAdjustmentPlan(lines).map((item) => [item.productId, item]),
    );

    return {
      count: {
        id: count.id,
        name: count.name,
        status: count.status,
        blind: count.blind,
        notes: count.notes,
        startedAt: count.startedAt.toISOString(),
        appliedAt: count.appliedAt?.toISOString() ?? null,
      },
      items: lines.map((line) => ({
        productId: line.productId,
        productName: line.productName,
        countedQuantity: line.countedQuantity,
        systemQuantity: reveal ? line.systemQuantity : null,
        divergence: reveal ? line.countedQuantity - line.systemQuantity : null,
        currentStock: reveal ? line.currentStock : null,
        driftedSinceCount: reveal
          ? (planByProduct.get(line.productId)?.driftedSinceCount ?? false)
          : false,
        countedAt: line.countedAt,
      })),
      summary: reveal ? summarizeCount(lines) : null,
    };
  });
