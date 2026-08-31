import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { validarGrafo } from "@/features/automacoes/lib/grafo";
import { CrmNodeType } from "@/generated/prisma/enums";
import prisma from "@/lib/db";

export const getWorkflow = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "Abre uma automação", tags: ["Automações"] })
  .input(z.object({ workflowId: z.string().min(1) }))
  .output(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable(),
      isActive: z.boolean(),
      funnelId: z.string(),
      maxRunsPerHour: z.number(),
      nos: z.array(
        z.object({
          id: z.string(),
          type: z.enum(CrmNodeType),
          name: z.string(),
          position: z.record(z.string(), z.number()),
          data: z.record(z.string(), z.unknown()),
        }),
      ),
      arestas: z.array(
        z.object({
          fromNodeId: z.string(),
          toNodeId: z.string(),
          fromOutput: z.string(),
        }),
      ),
      /** O que impede de ligar. Vazio significa pronta. */
      problemas: z.array(
        z.object({
          codigo: z.string(),
          mensagem: z.string(),
          nodeId: z.string().optional(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const workflow = await prisma.crmWorkflow.findFirst({
      where: { id: input.workflowId, organizationId: context.org.id },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        funnelId: true,
        maxRunsPerHour: true,
        nodes: {
          select: {
            id: true,
            type: true,
            name: true,
            position: true,
            data: true,
          },
        },
        connections: {
          select: { fromNodeId: true, toNodeId: true, fromOutput: true },
        },
      },
    });

    if (!workflow) {
      throw errors.NOT_FOUND({ message: "Automação não encontrada" });
    }

    const nos = workflow.nodes.map((no) => ({
      id: no.id,
      type: no.type,
      name: no.name,
      position: (no.position ?? {}) as Record<string, number>,
      data: (no.data ?? {}) as Record<string, unknown>,
    }));

    return {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      isActive: workflow.isActive,
      funnelId: workflow.funnelId,
      maxRunsPerHour: workflow.maxRunsPerHour,
      nos,
      arestas: workflow.connections,
      problemas: validarGrafo({ nos, arestas: workflow.connections }),
    };
  });
