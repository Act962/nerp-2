import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";

export const listCatalogs = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Listar catálogos promocionais",
    tags: ["promotional-catalog"],
  })
  .input(z.object({}))
  .output(
    z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        updatedAt: z.date(),
      }),
    ),
  )
  .handler(async ({ context }) => {
    const catalogs = await prisma.promotionalCatalog.findMany({
      where: { organizationId: context.org.id },
      select: { id: true, name: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });
    return catalogs;
  });
