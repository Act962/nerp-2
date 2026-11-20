import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireGestorFvMiddleware } from "@/app/middlewares/vendedor";
import { resumoDeVisitas } from "@/features/forca-vendas/server/campo";
import { z } from "zod";

// Planejado × visitado × fora do raio do dia.
export const resumoDeVisitasGestao = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireGestorFvMiddleware)
  .input(z.object({ dia: z.string().date() }))
  .handler(async ({ input, context }) => {
    const escopo = context.vendedor.escopo;
    return resumoDeVisitas({
      organizationId: context.org.id,
      memberIds: escopo.tipo === "TODOS" ? null : escopo.memberIds,
      dia: new Date(`${input.dia}T12:00:00`),
    });
  });
