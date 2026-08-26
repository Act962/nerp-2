import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import {
  createProductForOrg,
  ProductCreationError,
} from "@/features/products/server/create-product";

// Cria em lote os produtos "novos" escolhidos no wizard da aba "Lista". Reusa o
// helper `createProductForOrg` (mín.: nome + preço). Retorna, por item, o id
// criado ou o erro — sucesso parcial (uma linha ruim não derruba o lote).
export const createOfferProducts = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Criar produtos novos da lista de ofertas",
    tags: ["promotional-catalog"],
  })
  .input(
    z.object({
      products: z
        .array(
          z.object({
            name: z.string().min(1),
            salePrice: z.number().min(0),
            costPrice: z.number().min(0).optional(),
            // Código/EAN da planilha, quando houver: nasce já casável por
            // código nas próximas importações.
            barcode: z.string().optional(),
          }),
        )
        .max(500),
    }),
  )
  .output(
    z.array(
      z.object({
        index: z.number(),
        productId: z.string().nullable(),
        error: z.string().nullable(),
      }),
    ),
  )
  .handler(async ({ input, context }) => {
    const orgId = context.org.id;
    const userId = context.user.id;
    const results: {
      index: number;
      productId: string | null;
      error: string | null;
    }[] = [];

    for (let i = 0; i < input.products.length; i++) {
      const p = input.products[i];
      try {
        const created = await createProductForOrg(
          {
            name: p.name,
            costPrice: p.costPrice ?? 0,
            salePrice: p.salePrice,
            ...(p.barcode ? { barcode: p.barcode } : {}),
          },
          { orgId, userId },
        );
        results.push({ index: i, productId: created.id, error: null });
      } catch (e) {
        results.push({
          index: i,
          productId: null,
          error:
            e instanceof ProductCreationError || e instanceof Error
              ? e.message
              : "Erro ao criar produto",
        });
      }
    }
    return results;
  });
