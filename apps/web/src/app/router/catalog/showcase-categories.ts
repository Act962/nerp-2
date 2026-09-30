import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import z from "zod";

/**
 * As categorias que viram cartão na vitrine: só as de cima (sem pai). As
 * subcategorias entram pelo filtro da categoria-mãe, não como cartão próprio.
 */
export const listShowcaseCategories = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Categorias da vitrine do catálogo",
    tags: ["settings-catalog"],
  })
  .output(
    z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        image: z.string().nullable(),
        icon: z.string().nullable(),
        isActive: z.boolean(),
      }),
    ),
  )
  .handler(async ({ context }) => {
    return prisma.category.findMany({
      where: { organizationId: context.org.id, parentId: null },
      select: { id: true, name: true, image: true, icon: true, isActive: true },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    });
  });
