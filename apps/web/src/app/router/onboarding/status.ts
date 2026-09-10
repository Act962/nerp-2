import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";

/**
 * Ainda há dados de exemplo? É o que decide se o card de boas-vindas aparece.
 */
export const status = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Estado do onboarding",
    tags: ["Onboarding"],
  })
  .input(z.object({}))
  .output(
    z.object({
      temDadosDeExemplo: z.boolean(),
      exemplos: z.object({
        produtos: z.number(),
        clientes: z.number(),
        fornecedores: z.number(),
      }),
    }),
  )
  .handler(async ({ context }) => {
    const organizationId = context.org.id;
    const [produtos, clientes, fornecedores, lojas, catalogos] =
      await Promise.all([
        prisma.product.count({ where: { organizationId, isDemo: true } }),
        prisma.customer.count({ where: { organizationId, isDemo: true } }),
        prisma.supplier.count({ where: { organizationId, isDemo: true } }),
        prisma.store.count({ where: { organizationId, isDemo: true } }),
        prisma.promotionalCatalog.count({
          where: { organizationId, isDemo: true },
        }),
      ]);

    return {
      temDadosDeExemplo:
        produtos + clientes + fornecedores + lojas + catalogos > 0,
      exemplos: { produtos, clientes, fornecedores },
    };
  });
