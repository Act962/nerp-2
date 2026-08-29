import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { MovementType } from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import { z } from "zod";

// Ajuste por CONTAGEM: o operador informa quanto CONTOU, não quanto sobrou ou
// faltou. A diferença é o sistema que calcula — pedir o delta convida a erro de
// sinal no chão da loja, onde ninguém quer fazer subtração de cabeça.
//
// O movimento gravado registra a quantidade da DIFERENÇA (é o que moveu), mas
// `previousStock`/`newStock` contam a história inteira para a auditoria.
export const registerAdjustment = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    path: "/stock/adjustment",
    summary: "Ajustar estoque por contagem de inventário",
  })
  .input(
    z.object({
      productId: z.string(),
      /** Quantidade CONTADA na prateleira. */
      countedQuantity: z.number().min(0),
      description: z.string().optional(),
    }),
  )
  .output(
    z.object({
      movimentId: z.string().nullable(),
      previousStock: z.number(),
      newStock: z.number(),
      difference: z.number(),
    }),
  )
  .handler(async ({ context, input, errors }) => {
    const product = await prisma.product.findFirst({
      where: { id: input.productId, organizationId: context.org.id },
      select: { id: true, currentStock: true },
    });
    if (!product) {
      throw errors.NOT_FOUND({ message: "Produto não encontrado" });
    }

    const previousStock = product.currentStock.toNumber();
    const difference = input.countedQuantity - previousStock;

    // Contagem bateu com o sistema: nada moveu, e gravar movimento de zero só
    // sujaria o histórico. Devolvemos o resultado assim mesmo para a tela poder
    // dizer "conferido".
    if (difference === 0) {
      return {
        movimentId: null,
        previousStock,
        newStock: previousStock,
        difference: 0,
      };
    }

    const moviment = await prisma.$transaction(async (tx) => {
      const created = await tx.stockMovement.create({
        data: {
          type: MovementType.AJUSTE,
          quantity: Math.abs(difference),
          productId: product.id,
          notes:
            input.description ??
            `Inventário: contado ${input.countedQuantity}, sistema ${previousStock}`,
          organizationId: context.org.id,
          createdById: context.user.id,
          previousStock,
          newStock: input.countedQuantity,
        },
        select: { id: true },
      });
      await tx.product.update({
        where: { id: product.id },
        data: { currentStock: input.countedQuantity },
      });
      return created;
    });

    return {
      movimentId: moviment.id,
      previousStock,
      newStock: input.countedQuantity,
      difference,
    };
  });
