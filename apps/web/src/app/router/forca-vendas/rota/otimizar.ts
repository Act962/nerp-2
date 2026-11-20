import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireVendedorMiddleware } from "@/app/middlewares/vendedor";
import { otimizarRoteiro } from "@/features/forca-vendas/server/campo";
import { z } from "zod";

// Ordena as paradas pelo menor caminho a partir de onde o vendedor está.
export const otimizarRoteiroFv = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireVendedorMiddleware)
  .input(
    z.object({
      diaSemana: z.number().int().min(0).max(6),
      origem: z
        .object({ latitude: z.number(), longitude: z.number() })
        .nullish(),
    }),
  )
  .handler(async ({ input, context }) =>
    otimizarRoteiro({
      organizationId: context.org.id,
      vendedor: context.vendedor,
      ...input,
    }),
  );
