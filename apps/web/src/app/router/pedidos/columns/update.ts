import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import z from "zod";

export const updateKitchenColumn = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Atualizar coluna da cozinha",
    tags: ["kitchen"],
  })
  .input(
    z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      color: z
        .string()
        .regex(/^#([0-9a-fA-F]{6})$/)
        .optional(),
      wipLimit: z.number().int().positive().nullable().optional(),
      description: z.string().optional(),
      icon: z.string().optional(),
      isActive: z.boolean().optional(),
      isInitial: z.boolean().optional(),
      showOnTv: z.boolean().optional(),
      isFinal: z.boolean().optional(),
    }),
  )
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ context, input, errors }) => {
    const organizationId = context.org.id;
    const { id, ...rest } = input;

    const data: Prisma.KitchenColumnUpdateManyMutationInput = {
      ...(rest.name !== undefined ? { name: rest.name } : {}),
      ...(rest.color !== undefined ? { color: rest.color } : {}),
      ...(rest.wipLimit !== undefined ? { wipLimit: rest.wipLimit } : {}),
      ...(rest.description !== undefined
        ? { description: rest.description }
        : {}),
      ...(rest.icon !== undefined ? { icon: rest.icon } : {}),
      ...(rest.isActive !== undefined ? { isActive: rest.isActive } : {}),
      ...(rest.isInitial !== undefined ? { isInitial: rest.isInitial } : {}),
      ...(rest.showOnTv !== undefined ? { showOnTv: rest.showOnTv } : {}),
      ...(rest.isFinal !== undefined ? { isFinal: rest.isFinal } : {}),
    };

    await prisma.$transaction(async (tx) => {
      // Reaplica a unicidade de isInitial antes de marcar esta como entrada.
      if (rest.isInitial === true) {
        await tx.kitchenColumn.updateMany({
          where: { organizationId, isInitial: true, id: { not: id } },
          data: { isInitial: false },
        });
      }

      const result = await tx.kitchenColumn.updateMany({
        where: { id, organizationId },
        data,
      });

      if (result.count === 0) {
        throw errors.NOT_FOUND({ message: "Coluna não encontrada!" });
      }
    });

    return { success: true };
  });
