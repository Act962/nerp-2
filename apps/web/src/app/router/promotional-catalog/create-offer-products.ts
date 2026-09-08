import { z } from "zod";
import prisma from "@/lib/db";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import {
  createProductForOrg,
  ProductCreationError,
} from "@/features/products/server/create-product";
import { normalizeName } from "@/features/promotional-catalog/lib/product-match";

// Cria em lote os produtos "novos" escolhidos no wizard da aba "Lista". Reusa o
// helper `createProductForOrg` (mín.: nome + preço). Retorna, por item, o id
// criado ou o erro — sucesso parcial (uma linha ruim não derruba o lote).
//
// Antes de criar, reconsulta o cadastro pelo nome NORMALIZADO e devolve o id do
// que já existe (`reused`). `createProductForOrg` só garante slug único — e o
// desempate dele é acrescentar timestamp —, então sem esta trava cada
// importação que erra o casamento duplica o cadastro (foi assim que
// "...Refil - 700G" e "...Refil - 700g" viraram dois produtos).
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
        // true = já existia no cadastro; nada foi criado.
        reused: z.boolean(),
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
      reused: boolean;
    }[] = [];

    // Mesmo recorte do casamento (`isActive: true`): o que não é casável não
    // deve bloquear a criação de um produto novo com o mesmo nome.
    const existing = await prisma.product.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { id: true, name: true },
    });
    const idByName = new Map<string, string>();
    for (const p of existing) {
      const norm = normalizeName(p.name);
      if (norm && !idByName.has(norm)) idByName.set(norm, p.id);
    }

    for (let i = 0; i < input.products.length; i++) {
      const p = input.products[i];
      const norm = normalizeName(p.name);
      const duplicate = norm ? idByName.get(norm) : undefined;
      if (duplicate) {
        results.push({
          index: i,
          productId: duplicate,
          error: null,
          reused: true,
        });
        continue;
      }
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
        // Também segura duplicata DENTRO do próprio lote.
        if (norm) idByName.set(norm, created.id);
        results.push({
          index: i,
          productId: created.id,
          error: null,
          reused: false,
        });
      } catch (e) {
        results.push({
          index: i,
          productId: null,
          error:
            e instanceof ProductCreationError || e instanceof Error
              ? e.message
              : "Erro ao criar produto",
          reused: false,
        });
      }
    }
    return results;
  });
