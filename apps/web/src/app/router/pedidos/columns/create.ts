import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import z from "zod";

export const createKitchenColumn = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Criar coluna da cozinha",
    tags: ["kitchen"],
  })
  .input(
    z.object({
      name: z.string().min(1),
      color: z
        .string()
        .regex(/^#([0-9a-fA-F]{6})$/)
        .optional(),
      wipLimit: z.number().int().positive().nullable().optional(),
      description: z.string().optional(),
      icon: z.string().optional(),
      isInitial: z.boolean().optional(),
      showOnTv: z.boolean().optional(),
      isFinal: z.boolean().optional(),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ context, input }) => {
    const organizationId = context.org.id;

    const id = await prisma.$transaction(async (tx) => {
      const last = await tx.kitchenColumn.aggregate({
        where: { organizationId },
        _max: { position: true },
      });

      // Garante unicidade de isInitial: só uma coluna de entrada por org.
      if (input.isInitial) {
        await tx.kitchenColumn.updateMany({
          where: { organizationId, isInitial: true },
          data: { isInitial: false },
        });
      }

      const column = await tx.kitchenColumn.create({
        data: {
          organizationId,
          name: input.name,
          ...(input.color ? { color: input.color } : {}),
          wipLimit: input.wipLimit ?? null,
          description: input.description,
          icon: input.icon,
          isInitial: input.isInitial ?? false,
          showOnTv: input.showOnTv ?? false,
          isFinal: input.isFinal ?? false,
          position: (last._max.position ?? -1) + 1,
        },
        select: { id: true },
      });

      return column.id;
    });

    return { id };
  });
