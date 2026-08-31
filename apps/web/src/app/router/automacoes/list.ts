import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";

export const listWorkflows = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "Lista automações", tags: ["Automações"] })
  .input(z.object({ funnelId: z.string().optional() }))
  .output(
    z.object({
      automacoes: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          description: z.string().nullable(),
          isActive: z.boolean(),
          funnelId: z.string(),
          funnelName: z.string(),
          gatilho: z.string().nullable(),
          passos: z.number(),
          /** Execuções nas últimas 24h — o sinal de que está viva. */
          execucoes24h: z.number(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context }) => {
    const organizationId = context.org.id;
    const ontem = new Date(Date.now() - 86_400_000);

    const workflows = await prisma.crmWorkflow.findMany({
      where: {
        organizationId,
        ...(input.funnelId ? { funnelId: input.funnelId } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        funnelId: true,
        funnel: { select: { name: true } },
        nodes: { select: { type: true } },
        _count: { select: { runs: { where: { startedAt: { gte: ontem } } } } },
      },
    });

    return {
      automacoes: workflows.map((workflow) => ({
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        isActive: workflow.isActive,
        funnelId: workflow.funnelId,
        funnelName: workflow.funnel.name,
        gatilho:
          workflow.nodes.find((no) => no.type.startsWith("TRIGGER_"))?.type ??
          null,
        passos: workflow.nodes.filter((no) => !no.type.startsWith("TRIGGER_"))
          .length,
        execucoes24h: workflow._count.runs,
      })),
    };
  });
