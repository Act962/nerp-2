import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import type { MovementType } from "@/generated/prisma/enums";
import { z } from "zod";

export const listStock = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/stock",
    summary: "List all stock",
  })
  .input(
    z.object({
      name: z.string().optional(),
      /** Movimentações de UM produto — usado pelo atalho na lista de produtos. */
      productId: z.string().optional(),
      offset: z.number().min(0).default(0),
      limit: z.number().min(1).max(100).default(10),
      userIds: z.array(z.string()).optional(),
      dateInit: z.date().optional(),
      dateEnd: z.date().optional(),
    }),
  )
  .output(
    z.object({
      moviments: z.array(
        z.object({
          id: z.string(),
          createdAt: z.date(),
          type: z.custom<MovementType>(),
          quantity: z.number(),
          previousStock: z.number(),
          newStock: z.number(),
          notes: z.string().nullable(),
          product: z.object({
            id: z.string(),
            name: z.string(),
            sku: z.string().nullable(),
          }),
          user: z.object({
            id: z.string(),
            name: z.string(),
          }),
        }),
      ),
    }),
  )
  .handler(async ({ context, input }) => {
    console.log(input);
    const skip = (input.offset - 1) * input.limit;

    const query = await prisma.stockMovement.findMany({
      skip,
      take: input.limit,
      where: {
        organizationId: context.org.id,
        ...(input.productId && { productId: input.productId }),
        createdBy: {
          id: {
            in: input.userIds,
          },
          createdAt: {
            gte: input.dateInit,
            lte: input.dateEnd,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        type: true,
        quantity: true,
        previousStock: true,
        newStock: true,
        createdAt: true,
        notes: true,
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const moviments = [
      ...query.map((item) => ({
        ...item,
        newStock: item.newStock.toNumber(),
        previousStock: item.previousStock.toNumber(),
        quantity: item.quantity.toNumber(),
        user: {
          id: item.createdBy.id,
          name: item.createdBy.name,
        },
      })),
    ];

    return {
      moviments,
    };
  });
