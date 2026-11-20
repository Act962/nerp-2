import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireGestorFvMiddleware } from "@/app/middlewares/vendedor";
import { trajetoDoDia } from "@/features/forca-vendas/server/gestao";
import { z } from "zod";

// Pontos do dia de um vendedor (a linha do trajeto no mapa).
export const trajetoGestao = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireGestorFvMiddleware)
  .input(z.object({ memberId: z.string().min(1), dia: z.string().date() }))
  .handler(async ({ input, context }) =>
    trajetoDoDia({
      organizationId: context.org.id,
      gestor: context.vendedor,
      memberId: input.memberId,
      dia: new Date(`${input.dia}T12:00:00`),
    }),
  );
