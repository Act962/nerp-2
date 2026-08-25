import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import type { Category } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import z from "zod";

export const listAllCategories = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/categories",
    summary: "Listar todas as categorias",
  })
  .output(
    z.object({
      categories: z.array(z.custom<Category>()),
    }),
  )
  .handler(async ({ context }) => {
    const categories = await prisma.category.findMany({
      where: {
        organizationId: context.org.id,
      },
      orderBy: {
        name: "asc",
      },
    });

    return {
      categories,
    };
  });
