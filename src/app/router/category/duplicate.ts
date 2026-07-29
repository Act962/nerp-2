import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import { z } from "zod";

export const duplicateCategory = base
  .use(requireAuthMiddleware)
  .route({
    method: "POST",
    path: "/category/{id}/duplicate",
    summary: "Duplicar categoria",
    tags: ["Category"],
  })
  .input(
    z.object({
      id: z.string(),
    }),
  )
  .output(
    z.object({
      id: z.string(),
      categoryName: z.string(),
    }),
  )
  .handler(async ({ errors, input }) => {
    const categoryExists = await prisma.category.findUnique({
      where: {
        id: input.id,
      },
    });

    if (!categoryExists) {
      throw errors.BAD_REQUEST({
        message: "Categoria não existe",
      });
    }

    const newSlug = `${categoryExists.slug}-${Date.now()}`;

    const duplicatedCategory = await prisma.category.create({
      data: {
        ...categoryExists,
        id: undefined,
        slug: newSlug,
        order: categoryExists.order + 1,
      },
    });

    return {
      id: duplicatedCategory.id,
      categoryName: duplicatedCategory.name,
    };
  });
