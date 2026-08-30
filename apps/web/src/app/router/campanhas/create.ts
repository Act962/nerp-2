import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireFunnelDaOrg } from "@/app/router/crm/_access";
import prisma from "@/lib/db";

/**
 * Cria a campanha como rascunho.
 *
 * Nasce presa a um funil porque é do número daquele funil que a mensagem sai —
 * e é entre os clientes daquele funil que a audiência é montada.
 */
export const createCampanha = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Cria uma campanha", tags: ["Campanhas"] })
  .input(
    z.object({
      funnelId: z.string().min(1),
      name: z.string().trim().min(1, "Dê um nome para a campanha"),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context }) => {
    const organizationId = context.org.id;
    await requireFunnelDaOrg(input.funnelId, organizationId);

    const campanha = await prisma.broadcast.create({
      data: {
        organizationId,
        funnelId: input.funnelId,
        createdById: context.user.id,
        name: input.name,
      },
      select: { id: true },
    });

    return { id: campanha.id };
  });
