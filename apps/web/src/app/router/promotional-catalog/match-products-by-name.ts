import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";

// Casa nomes de produtos (da aba "Lista") com produtos do cadastro, para trazer a
// imagem. Best-effort: usa as primeiras palavras significativas do nome como
// termo `contains` (índice trigram). O gestor confere/ajusta na tabela.

function searchKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .slice(0, 2)
    .join(" ")
    .trim();
}

export const matchProductsByName = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Casar nomes de produtos com o cadastro (para imagens)",
    tags: ["promotional-catalog"],
  })
  .input(z.object({ names: z.array(z.string()).max(500) }))
  .output(
    z.array(
      z.object({
        name: z.string(),
        productId: z.string().nullable(),
        matchedName: z.string().nullable(),
        thumbnail: z.string().nullable(),
      }),
    ),
  )
  .handler(async ({ input, context }) => {
    const orgId = context.org.id;
    const CHUNK = 8;
    const results: {
      name: string;
      productId: string | null;
      matchedName: string | null;
      thumbnail: string | null;
    }[] = [];

    for (let i = 0; i < input.names.length; i += CHUNK) {
      const chunk = input.names.slice(i, i + CHUNK);
      const matched = await Promise.all(
        chunk.map(async (name) => {
          const key = searchKey(name);
          if (!key)
            return {
              name,
              productId: null,
              matchedName: null,
              thumbnail: null,
            };
          const p = await prisma.product.findFirst({
            where: {
              organizationId: orgId,
              isActive: true,
              name: { contains: key, mode: "insensitive" as const },
            },
            select: { id: true, name: true, thumbnail: true },
            orderBy: { name: "asc" },
          });
          return p
            ? {
                name,
                productId: p.id,
                matchedName: p.name,
                thumbnail: p.thumbnail || null,
              }
            : { name, productId: null, matchedName: null, thumbnail: null };
        }),
      );
      results.push(...matched);
    }

    return results;
  });
