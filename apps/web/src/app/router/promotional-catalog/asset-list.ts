import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";

// Lista as etiquetas (PNGs) da organização, mais recentes primeiro.
export const listCatalogAssets = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Listar etiquetas do catálogo",
    tags: ["promotional-catalog"],
  })
  .input(z.object({}))
  .output(
    z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        key: z.string(),
      }),
    ),
  )
  .handler(async ({ context }) => {
    return prisma.catalogAsset.findMany({
      where: { organizationId: context.org.id },
      select: { id: true, name: true, key: true },
      orderBy: { createdAt: "desc" },
    });
  });
