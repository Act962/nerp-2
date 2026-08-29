import { buildAdjustmentPlan } from "@/features/stock/lib/inventory-count";
import { MovementType } from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import { z } from "zod";
import { p } from "./_shared";

// Encerra a contagem lançando as divergências como AJUSTE.
//
// Tudo numa transação: ou o inventário inteiro entra, ou nada entra. Meio
// inventário aplicado é pior que nenhum, porque ninguém sabe onde parou.
export const applyInventoryCount = p
  .input(z.object({ id: z.string() }))
  .output(
    z.object({
      adjusted: z.number(),
      netUnits: z.number(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const count = await prisma.inventoryCount.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: {
        id: true,
        status: true,
        name: true,
        items: {
          select: {
            productId: true,
            countedQuantity: true,
            systemQuantity: true,
            product: { select: { name: true, currentStock: true } },
          },
        },
      },
    });
    if (!count) throw errors.NOT_FOUND({ message: "Contagem não encontrada" });
    if (count.status !== "OPEN") {
      // Sem esta trava, aplicar duas vezes dobraria cada divergência.
      throw errors.BAD_REQUEST({ message: "Esta contagem já foi encerrada" });
    }
    if (count.items.length === 0) {
      throw errors.BAD_REQUEST({
        message: "Nenhum produto foi contado nesta sessão",
      });
    }

    const plan = buildAdjustmentPlan(
      count.items.map((item) => ({
        productId: item.productId,
        productName: item.product.name,
        countedQuantity: item.countedQuantity.toNumber(),
        systemQuantity: item.systemQuantity.toNumber(),
        currentStock: item.product.currentStock.toNumber(),
      })),
    );

    await prisma.$transaction(async (tx) => {
      for (const item of plan) {
        await tx.stockMovement.create({
          data: {
            type: MovementType.AJUSTE,
            quantity: Math.abs(item.divergence),
            productId: item.productId,
            organizationId: context.org.id,
            createdById: context.user.id,
            previousStock: item.currentStock,
            newStock: item.newStock,
            notes: `Inventário "${count.name}": ${
              item.divergence > 0 ? "sobra" : "falta"
            } de ${Math.abs(item.divergence)}`,
          },
        });
        await tx.product.update({
          where: { id: item.productId },
          data: { currentStock: item.newStock },
        });
      }

      await tx.inventoryCount.update({
        where: { id: count.id },
        data: { status: "APPLIED", appliedAt: new Date() },
      });
    });

    return {
      adjusted: plan.length,
      netUnits: plan.reduce((sum, item) => sum + item.divergence, 0),
    };
  });
