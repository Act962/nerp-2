import "server-only";

import prisma from "@/lib/db";
import type { Grafo } from "../lib/grafo";

/**
 * Carrega o grafo de um workflow, já confrontado com a organização.
 *
 * Devolve `null` em vez de lançar quando o workflow sumiu ou é de outra
 * organização — quem chama é o executor, e workflow apagado no meio da espera
 * é um caso normal, não um erro.
 */
export async function carregarGrafo(
  workflowId: string,
  organizationId: string,
): Promise<
  | (Grafo & {
      id: string;
      funnelId: string;
      isActive: boolean;
      createdById: string | null;
    })
  | null
> {
  const workflow = await prisma.crmWorkflow.findFirst({
    where: { id: workflowId, organizationId },
    select: {
      id: true,
      funnelId: true,
      isActive: true,
      createdById: true,
      nodes: {
        select: { id: true, type: true, name: true, data: true },
      },
      connections: {
        select: { fromNodeId: true, toNodeId: true, fromOutput: true },
      },
    },
  });

  if (!workflow) return null;

  return {
    id: workflow.id,
    funnelId: workflow.funnelId,
    isActive: workflow.isActive,
    createdById: workflow.createdById,
    nos: workflow.nodes.map((no) => ({
      id: no.id,
      type: no.type,
      name: no.name,
      data: (no.data ?? {}) as Record<string, unknown>,
    })),
    arestas: workflow.connections,
  };
}
