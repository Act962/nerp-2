import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";
import { repathSubtree } from "./hierarchy";

export const updateCategory = base
  .use(requireAuthMiddleware)
  // requireOrgMiddleware estava faltando: sem ele, o findUnique por id abaixo
  // permitia a qualquer usuário autenticado editar categoria de outra org.
  .use(requireOrgMiddleware)
  .route({
    method: "PUT",
    path: "/category/:id",
    summary: "Atualizar categoria",
    tags: ["categories"],
  })
  .input(
    z.object({
      id: z.string(),
      name: z.string().optional(),
      slug: z.string().optional(),
      description: z.string().optional(),
      parentId: z.string().nullable().optional(),
    }),
  )
  .output(
    z.object({
      categoryName: z.string(),
    }),
  )
  .handler(async ({ errors, input, context }) => {
    const categoryExists = await prisma.category.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true, parentId: true },
    });

    if (!categoryExists) {
      throw errors.NOT_FOUND({
        message: "Categoria não encontrada.",
      });
    }

    // Reparentar para um descendente criaria um ciclo e o path entraria em
    // recursão infinita. O banco não impede — a checagem tem que ser aqui.
    if (input.parentId) {
      const target = await prisma.category.findFirst({
        where: { id: input.parentId, organizationId: context.org.id },
        select: { id: true, path: true },
      });
      if (!target) {
        throw errors.NOT_FOUND({ message: "Categoria pai não encontrada." });
      }
      const targetPath = target.path ?? target.id;
      if (target.id === input.id || targetPath.split("/").includes(input.id)) {
        throw errors.BAD_REQUEST({
          message: "Não é possível mover uma categoria para dentro dela mesma.",
        });
      }
    }

    const category = await prisma.category.update({
      where: { id: input.id },
      data: {
        name: input.name,
        slug: input.slug,
        description: input.description,
        parentId: input.parentId,
      },
    });

    // Só reescreve a subárvore quando o pai realmente mudou.
    if (
      input.parentId !== undefined &&
      input.parentId !== categoryExists.parentId
    ) {
      await repathSubtree(input.id, context.org.id);
    }

    return {
      categoryName: category.name,
    };
  });
