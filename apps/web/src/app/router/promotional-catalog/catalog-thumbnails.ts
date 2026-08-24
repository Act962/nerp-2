import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";

// Miniaturas (data URL) dos catálogos da org, numa query SEPARADA da lista.
// A lista (`list`) fica leve e a grade aparece na hora; as miniaturas chegam
// aqui em segundo plano e preenchem os cards conforme carregam. Só retorna as
// que existem (thumbnail != null) para não trafegar linhas vazias.
export const catalogThumbnails = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Miniaturas dos catálogos promocionais",
    tags: ["promotional-catalog"],
  })
  .input(z.object({}))
  .output(z.array(z.object({ id: z.string(), thumbnail: z.string() })))
  .handler(async ({ context }) => {
    const rows = await prisma.promotionalCatalog.findMany({
      where: { organizationId: context.org.id, thumbnail: { not: null } },
      select: { id: true, thumbnail: true },
    });
    return rows.map((r) => ({ id: r.id, thumbnail: r.thumbnail ?? "" }));
  });
