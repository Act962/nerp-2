import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { z } from "zod";

const DEFAULT_LIMIT = 500;

/**
 * Sync incremental do catálogo (server → device) para o modo offline.
 *
 * Keyset por `(updatedAt, id)`: o device guarda o cursor da última sync e pede
 * só o que mudou depois. Ordem estável `(updatedAt asc, id asc)` evita pular ou
 * duplicar linhas com o mesmo `updatedAt` (ex.: importação em lote). Como o
 * device faz upsert, reprocessar a borda é inofensivo.
 *
 * Escopado por `context.org.id` (org do device) — nunca por dado do input.
 */
export const pullProducts = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      // Cursor da última sync; null = primeira sync (tudo).
      updatedAt: z.string().nullable(),
      id: z.string().nullable(),
      limit: z.number().int().min(1).max(1000).default(DEFAULT_LIMIT),
    }),
  )
  .output(
    z.object({
      products: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          sku: z.string(),
          barcode: z.string(),
          salePrice: z.number(),
          currentStock: z.number(),
          unit: z.string(),
          isActive: z.boolean(),
          updatedAt: z.string(),
        }),
      ),
      // Watermark desta página (última linha). O device PERSISTE mesmo com
      // hasMore=false — é o ponto de partida da próxima sessão de sync.
      // null só quando não veio nenhuma linha.
      cursor: z.object({ updatedAt: z.string(), id: z.string() }).nullable(),
      // true = página cheia, provavelmente há mais para puxar agora.
      hasMore: z.boolean(),
    }),
  )
  .handler(async ({ context, input }) => {
    const cursorFilter: Prisma.ProductWhereInput | undefined =
      input.updatedAt && input.id
        ? {
            OR: [
              { updatedAt: { gt: new Date(input.updatedAt) } },
              {
                updatedAt: new Date(input.updatedAt),
                id: { gt: input.id },
              },
            ],
          }
        : undefined;

    const rows = await prisma.product.findMany({
      where: {
        organizationId: context.org.id,
        ...cursorFilter,
      },
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        salePrice: true,
        currentStock: true,
        unit: true,
        isActive: true,
        updatedAt: true,
      },
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: input.limit,
    });

    const products = rows.map((row) => ({
      id: row.id,
      name: row.name,
      sku: row.sku ?? "",
      barcode: row.barcode ?? "",
      salePrice: row.salePrice.toNumber(),
      currentStock: row.currentStock.toNumber(),
      unit: row.unit,
      isActive: row.isActive,
      updatedAt: row.updatedAt.toISOString(),
    }));

    const last = rows[rows.length - 1];
    const cursor = last
      ? { updatedAt: last.updatedAt.toISOString(), id: last.id }
      : null;

    return { products, cursor, hasMore: rows.length === input.limit };
  });
