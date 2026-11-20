import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireVendedorMiddleware } from "@/app/middlewares/vendedor";
import { roteiroDoDia } from "@/features/forca-vendas/server/campo";
import { z } from "zod";

// Agenda de um dia da semana, com a visita de hoje de cada cliente.
export const roteiroDoDiaFv = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireVendedorMiddleware)
  .input(z.object({ diaSemana: z.number().int().min(0).max(6) }))
  .handler(async ({ input, context }) =>
    roteiroDoDia({
      organizationId: context.org.id,
      vendedor: context.vendedor,
      diaSemana: input.diaSemana,
    }),
  );
