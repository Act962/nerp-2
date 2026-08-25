import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const updatePlanogram = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      status: z
        .enum(["RASCUNHO", "EM_APROVACAO", "ATIVO", "ARQUIVADO"])
        .optional(),
      isActive: z.boolean().optional(),
      releaseAt: z.string().nullable().optional(),
      categoryId: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { id, releaseAt, ...rest } = input;

    const planogram = await prisma.planogram.findFirst({
      where: { id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!planogram) {
      throw errors.NOT_FOUND({ message: "Planograma não encontrado" });
    }

    if (rest.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: rest.categoryId, organizationId: context.org.id },
        select: { id: true },
      });
      if (!category) {
        throw errors.NOT_FOUND({ message: "Categoria não encontrada" });
      }
    }

    return prisma.planogram.update({
      where: { id },
      data: {
        ...rest,
        releaseAt:
          releaseAt === undefined
            ? undefined
            : releaseAt
              ? new Date(releaseAt)
              : null,
      },
      select: { id: true },
    });
  });
