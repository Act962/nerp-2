import { ORPCError } from "@orpc/server";
import prisma from "@/lib/db";

/** Confronta o workflow com a organização antes de qualquer uso do id. */
export async function requireWorkflowDaOrg(
  workflowId: string,
  organizationId: string,
): Promise<{ id: string; funnelId: string }> {
  const workflow = await prisma.crmWorkflow.findFirst({
    where: { id: workflowId, organizationId },
    select: { id: true, funnelId: true },
  });
  if (!workflow) {
    throw new ORPCError("NOT_FOUND", { message: "Automação não encontrada" });
  }
  return workflow;
}
