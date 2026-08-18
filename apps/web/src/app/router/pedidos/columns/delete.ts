import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import z from "zod";

export const deleteKitchenColumn = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Apagar coluna da cozinha",
    tags: ["kitchen"],
  })
  .input(z.object({ id: z.string() }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ context, input, errors }) => {
    const organizationId = context.org.id;

    await prisma.$transaction(async (tx) => {
      const column = await tx.kitchenColumn.findFirst({
        where: { id: input.id, organizationId },
        select: { id: true, isInitial: true },
      });

      if (!column) {
        throw errors.NOT_FOUND({ message: "Coluna não encontrada!" });
      }

      // 1. Não pode apagar a única coluna de entrada da org.
      if (column.isInitial) {
        const initialCount = await tx.kitchenColumn.count({
          where: { organizationId, isInitial: true },
        });
        if (initialCount <= 1) {
          throw errors.BAD_REQUEST({
            message: "A organização precisa de ao menos uma coluna de entrada.",
          });
        }
      }

      // 2. Não pode apagar coluna com cards (casa com onDelete: Restrict).
      const cards = await tx.kitchenOrder.count({
        where: { columnId: column.id },
      });
      if (cards > 0) {
        throw errors.BAD_REQUEST({
          message: "Mova ou remova os pedidos antes de apagar a coluna",
        });
      }

      await tx.kitchenColumn.deleteMany({
        where: { id: column.id, organizationId },
      });
    });

    return { success: true };
  });
