import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Casa uma lista de SKUs (extraídos do nome dos arquivos) com produtos da org.
// Alimenta o assistente "Importar imagens em massa" — o cliente monta a lista
// pelo <input type=file webkitdirectory>, o server só faz o match, sem tocar
// no S3. Case-insensitive: SKUs no banco geralmente vêm maiúsculos; nomes de
// arquivo podem vir de qualquer forma.
export const matchProductsBySku = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      skus: z.array(z.string().min(1)).min(1).max(2000),
    }),
  )
  .output(
    z.object({
      matches: z.array(
        z.object({
          sku: z.string(), // sku de busca original (do arquivo)
          product: z
            .object({
              id: z.string(),
              name: z.string(),
              sku: z.string().nullable(),
              hasThumbnail: z.boolean(),
              imagesCount: z.number(),
            })
            .nullable(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context }) => {
    // Uniqueness + normalização: SKUs vindos de nomes de arquivo podem repetir
    // (arquivo.jpg + arquivo.png) e vir em qualquer caixa. Normaliza p/ upper
    // e busca 1x — depois mapeia de volta ao SKU original de cada entrada.
    const normalized = new Set<string>();
    for (const sku of input.skus) normalized.add(sku.trim().toUpperCase());
    const distinctUpper = [...normalized].filter(Boolean);

    // Prisma não tem `mode: insensitive` no `in` — buscamos por raw upper.
    // A coluna `sku` da tabela é case-preserving; nossos usuários costumam
    // digitar em MAIÚSCULAS. Se algum produto tiver sido cadastrado em
    // minúsculas, a busca abaixo não pega — fica documentado.
    const products = await prisma.product.findMany({
      where: {
        organizationId: context.org.id,
        sku: { in: distinctUpper },
      },
      select: {
        id: true,
        name: true,
        sku: true,
        thumbnail: true,
        images: true,
      },
    });

    // Também aceita SKU original (case-preserving) — cobre orgs que salvaram
    // em minúscula. União dos dois resultados.
    const productsCase = await prisma.product.findMany({
      where: {
        organizationId: context.org.id,
        sku: { in: input.skus },
      },
      select: {
        id: true,
        name: true,
        sku: true,
        thumbnail: true,
        images: true,
      },
    });

    const byUpper = new Map<
      string,
      {
        id: string;
        name: string;
        sku: string | null;
        thumbnail: string | null;
        images: string[];
      }
    >();
    for (const product of [...products, ...productsCase]) {
      if (product.sku) byUpper.set(product.sku.trim().toUpperCase(), product);
    }

    const matches = input.skus.map((sku) => {
      const key = sku.trim().toUpperCase();
      const product = byUpper.get(key);
      return {
        sku,
        product: product
          ? {
              id: product.id,
              name: product.name,
              sku: product.sku,
              hasThumbnail: !!product.thumbnail,
              imagesCount: product.images.length,
            }
          : null,
      };
    });

    return { matches };
  });
