import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { MovementType } from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import { z } from "zod";

export const registerOutput = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    path: "/stock/output",
    summary: "Register a stock output",
  })
  .input(
    z.object({
      type: z.custom<MovementType>().default(MovementType.SAIDA),
      quantity: z.number().min(1),
      productId: z.string(),
      description: z.string().optional(),
    }),
  )
  .output(
    z.object({
      movimentId: z.string(),
    }),
  )
  .handler(async ({ context, input, errors }) => {
    // `findFirst` com organizationId, não `findUnique` por id: sem o filtro,
    // qualquer usuário autenticado movimentaria estoque de outra org (IDOR).
    const product = await prisma.product.findFirst({
      where: {
        id: input.productId,
        organizationId: context.org.id,
      },
    });

    if (!product) {
      throw errors.NOT_FOUND({
        message: "Produto não encontrado",
      });
    }

    const newStock = product.currentStock.toNumber() - input.quantity;

    if (newStock < 0) {
      throw errors.BAD_REQUEST({
        message: "Estoque insuficiente",
      });
    }

    const moviment = await prisma.stockMovement.create({
      data: {
        type: input.type,
        quantity: input.quantity,
        productId: product.id,
        notes: input.description,
        organizationId: context.org.id,
        createdById: context.user.id,
        previousStock: product.currentStock,
        newStock: newStock,
      },
    });

    await prisma.product.update({
      where: {
        id: product.id,
      },
      data: {
        currentStock: newStock,
      },
    });

    return {
      movimentId: moviment.id,
    };
  });
