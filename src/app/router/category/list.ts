import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";

export const listCategories = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Listar categorias",
    tags: ["categories"],
  })
  .output(
    z.object({
      categories: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          slug: z.string(),
          description: z.string().nullable(),
          productsCount: z.number(),
          children: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              slug: z.string(),
              description: z.string().nullable(),
              productsCount: z.number(),
              parentId: z.string().nullable(),
            })
          ),
        })
      ),
    })
  )
  .handler(async ({ context }) => {
    // Uma query só: as outras duas que existiam aqui (`categoriesWithoutChildren`
    // e `allCategories`) eram buscadas e nunca usadas no retorno — trabalho de
    // banco puro em toda chamada.
    const categoriesWithChildren = await prisma.category.findMany({
      where: {
        organizationId: context.org.id,
        parentId: null,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        _count: { select: { products: true } },
        children: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            parentId: true,
            _count: { select: { products: true } },
          },
          orderBy: { name: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    // Formata os dados para o formato esperado pelo componente
    const formattedCategories = categoriesWithChildren.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      productsCount: category._count.products,
      children: category.children.map((child) => ({
        id: child.id,
        name: child.name,
        slug: child.slug,
        description: child.description,
        productsCount: child._count.products,
        parentId: child.parentId,
      })),
    }));

    return {
      categories: formattedCategories,
    };
  });
