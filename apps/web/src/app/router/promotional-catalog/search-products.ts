import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";

// Busca enxuta de produtos para o typeahead da aba "Lista" (campo "Nome do
// produto"). Retorna o essencial para preencher a linha: nome, imagem, preço de
// cadastro e categoria. Sem count (índice trigram em name faz o trabalho).
export const searchCatalogProducts = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Buscar produtos (typeahead da aba Lista)",
    tags: ["promotional-catalog"],
  })
  .input(
    z.object({
      q: z.string(),
      limit: z.number().int().min(1).max(20).optional(),
    }),
  )
  .output(
    z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        thumbnail: z.string(),
        salePrice: z.number(),
        categoryName: z.string().nullable(),
      }),
    ),
  )
  .handler(async ({ input, context }) => {
    const q = input.q.trim();
    if (q.length < 2) return [];
    const rows = await prisma.product.findMany({
      where: {
        organizationId: context.org.id,
        isActive: true,
        name: { contains: q, mode: "insensitive" as const },
      },
      select: {
        id: true,
        name: true,
        thumbnail: true,
        salePrice: true,
        category: { select: { name: true } },
      },
      orderBy: { name: "asc" },
      take: input.limit ?? 8,
    });
    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      thumbnail: p.thumbnail || "",
      salePrice: p.salePrice.toNumber(),
      categoryName: p.category?.name ?? null,
    }));
  });
