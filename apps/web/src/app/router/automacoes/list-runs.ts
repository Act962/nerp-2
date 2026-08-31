import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { requireWorkflowDaOrg } from "./_access";

/** O histórico é onde se descobre por que a automação não fez o que parecia. */
export const listRuns = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "Execuções", tags: ["Automações"] })
  .input(
    z.object({
      workflowId: z.string().min(1),
      limite: z.number().int().min(1).max(100).default(30),
    }),
  )
  .output(
    z.object({
      execucoes: z.array(
        z.object({
          id: z.string(),
          status: z.string(),
          gatilho: z.string(),
          leadNome: z.string().nullable(),
          passos: z.number(),
          erro: z.string().nullable(),
          iniciadaEm: z.string(),
          terminadaEm: z.string().nullable(),
          etapas: z.array(
            z.object({
              no: z.string(),
              status: z.string(),
              erro: z.string().nullable(),
            }),
          ),
        }),
      ),
    }),
  )
  .handler(async ({ input, context }) => {
    const organizationId = context.org.id;
    const workflow = await requireWorkflowDaOrg(
      input.workflowId,
      organizationId,
    );

    const execucoes = await prisma.crmWorkflowRun.findMany({
      where: { workflowId: workflow.id, organizationId },
      orderBy: { startedAt: "desc" },
      take: input.limite,
      select: {
        id: true,
        status: true,
        triggerType: true,
        nodesExecuted: true,
        errorMessage: true,
        startedAt: true,
        finishedAt: true,
        lead: { select: { name: true } },
        nodeRuns: {
          orderBy: { startedAt: "asc" },
          select: {
            status: true,
            errorMessage: true,
            node: { select: { name: true } },
          },
        },
      },
    });

    return {
      execucoes: execucoes.map((execucao) => ({
        id: execucao.id,
        status: execucao.status,
        gatilho: execucao.triggerType,
        leadNome: execucao.lead?.name ?? null,
        passos: execucao.nodesExecuted,
        erro: execucao.errorMessage,
        iniciadaEm: execucao.startedAt.toISOString(),
        terminadaEm: execucao.finishedAt?.toISOString() ?? null,
        etapas: execucao.nodeRuns.map((etapa) => ({
          no: etapa.node.name,
          status: etapa.status,
          erro: etapa.errorMessage,
        })),
      })),
    };
  });
