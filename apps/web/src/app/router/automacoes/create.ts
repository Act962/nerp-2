import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireFunnelDaOrg } from "@/app/router/crm/_access";
import prisma from "@/lib/db";

/**
 * Cria a automação já com o gatilho escolhido, e **desligada**.
 *
 * Nasce desligada porque um grafo com um nó só não faz nada útil, e porque
 * automação que já nasce ligada manda mensagem para cliente antes de alguém
 * ter lido o que ela faz.
 */
export const createWorkflow = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Cria automação", tags: ["Automações"] })
  .input(
    z.object({
      funnelId: z.string().min(1),
      name: z.string().trim().min(1, "Dê um nome à automação"),
      gatilho: z.enum([
        "TRIGGER_NEW_LEAD",
        "TRIGGER_MESSAGE_IN",
        "TRIGGER_STAGE_CHANGED",
        "TRIGGER_LEAD_IDLE",
        "TRIGGER_MANUAL",
      ]),
      /** Minutos de silêncio, só para `TRIGGER_LEAD_IDLE`. */
      minutos: z.number().int().min(1).optional(),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.org.id;
    await requireFunnelDaOrg(input.funnelId, organizationId);

    if (input.gatilho === "TRIGGER_LEAD_IDLE" && !input.minutos) {
      throw errors.BAD_REQUEST({
        message: "Diga em quantos minutos de silêncio a automação deve rodar.",
      });
    }

    const workflow = await prisma.crmWorkflow.create({
      data: {
        organizationId,
        funnelId: input.funnelId,
        createdById: context.user.id,
        name: input.name,
        nodes: {
          create: {
            organizationId,
            type: input.gatilho,
            name: "Quando isto acontecer",
            position: { x: 0, y: 0 },
            data: input.minutos ? { minutos: input.minutos } : {},
          },
        },
      },
      select: { id: true },
    });

    return workflow;
  });
