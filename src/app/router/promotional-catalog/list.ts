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
        thumbnail: z.string().nullable(),
        updatedAt: z.date(),
        createdAt: z.date(),
        createdBy: z
          .object({ name: z.string(), image: z.string().nullable() })
          .nullable(),
      }),
    ),
  )
  .handler(async ({ context }) => {
    const catalogs = await prisma.promotionalCatalog.findMany({
      where: { organizationId: context.org.id },
      select: {
        id: true,
        name: true,
        thumbnail: true,
        updatedAt: true,
        createdAt: true,
        createdBy: { select: { name: true, image: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    return catalogs.map((c) => ({
      id: c.id,
      name: c.name,
      thumbnail: c.thumbnail,
      updatedAt: c.updatedAt,
      createdAt: c.createdAt,
      createdBy: c.createdBy
        ? { name: c.createdBy.name ?? "", image: c.createdBy.image ?? null }
        : null,
    }));
  });
