import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { validarGrafo } from "@/features/automacoes/lib/grafo";
import prisma from "@/lib/db";
import { requireWorkflowDaOrg } from "./_access";

/**
 * Liga ou desliga a automação.
 *
 * Ligar valida o grafo antes: automação ligada que nunca dispara — porque o
 * gatilho não leva a lugar nenhum, ou porque um passo ficou solto — é pior que
 * automação desligada, porque o operador acha que está resolvido.
 *
 * Desligar nunca valida: precisa funcionar mesmo com o desenho quebrado, que
 * é justamente quando alguém quer desligar às pressas.
 */
export const toggleWorkflow = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Liga/desliga", tags: ["Automações"] })
  .input(z.object({ workflowId: z.string().min(1), isActive: z.boolean() }))
  .output(z.object({ isActive: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.org.id;
    const workflow = await requireWorkflowDaOrg(
      input.workflowId,
      organizationId,
    );

    if (input.isActive) {
      const completo = await prisma.crmWorkflow.findUniqueOrThrow({
        where: { id: workflow.id },
        select: {
          nodes: { select: { id: true, type: true, name: true, data: true } },
          connections: {
            select: { fromNodeId: true, toNodeId: true, fromOutput: true },
          },
        },
      });

      const problemas = validarGrafo({
        nos: completo.nodes.map((no) => ({
          id: no.id,
          type: no.type,
          name: no.name,
          data: (no.data ?? {}) as Record<string, unknown>,
        })),
        arestas: completo.connections,
      });

      if (problemas.length > 0) {
        throw errors.BAD_REQUEST({ message: problemas[0].mensagem });
      }
    }

    await prisma.crmWorkflow.update({
      where: { id: workflow.id },
      data: { isActive: input.isActive },
    });

    return { isActive: input.isActive };
  });
