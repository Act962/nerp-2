import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import z from "zod";

export const listWithoutSubcategory = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/category/without-subcategory",
    summary: "Listar categorias sem subcategorias",
    tags: ["Category"],
  })
  .output(
    z.object({
      categories: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
        }),
      ),
    }),
  )
  .handler(async ({ context }) => {
    const categories = await prisma.category.findMany({
      where: {
        organizationId: context.org.id,
        parentId: null,
      },
      select: {
        id: true,
        name: true,
      },
    });

    return {
      categories,
    };
  });
