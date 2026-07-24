import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const createPlanogram = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      name: z.string().min(1, "Informe o nome do planograma"),
      code: z.string().trim().max(40).optional(),
      categoryId: z.string().optional(),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    if (input.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: input.categoryId, organizationId: context.org.id },
        select: { id: true },
      });
      if (!category) {
        throw errors.NOT_FOUND({ message: "Categoria não encontrada" });
      }
    }

    // `code` é único por org quando informado; string vazia vira null para não
    // colidir com outro planograma sem código.
    const code = input.code?.trim() || null;
    if (code) {
      const existing = await prisma.planogram.findFirst({
        where: { organizationId: context.org.id, code },
        select: { id: true },
      });
      if (existing) {
        throw errors.BAD_REQUEST({
          message: "Já existe um planograma com esse código",
        });
      }
    }

    const planogram = await prisma.planogram.create({
      data: {
        organizationId: context.org.id,
        name: input.name,
        code,
        categoryId: input.categoryId,
        createdById: context.user.id,
      },
      select: { id: true },
    });

    return { id: planogram.id };
  });
