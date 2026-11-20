import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireVendedorMiddleware } from "@/app/middlewares/vendedor";
import { registrarPontos } from "@/features/forca-vendas/server/campo";
import { z } from "zod";

// Lote de pontos da jornada (o celular junta e manda de tempos em tempos).
export const registrarLocalizacaoFv = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireVendedorMiddleware)
  .input(
    z.object({
      origem: z.enum(["PING", "PEDIDO"]).default("PING"),
      pontos: z
        .array(
          z.object({
            capturadoEm: z.string().datetime(),
            latitude: z.number().min(-90).max(90),
            longitude: z.number().min(-180).max(180),
            precisaoM: z.number().min(0).nullish(),
            bateria: z.number().int().min(0).max(100).nullish(),
          }),
        )
        .max(500),
    }),
  )
  .handler(async ({ input, context }) =>
    registrarPontos({
      organizationId: context.org.id,
      memberId: context.vendedor.memberId,
      origem: input.origem,
      pontos: input.pontos,
    }),
  );
