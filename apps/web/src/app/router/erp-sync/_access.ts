import { ORPCError } from "@orpc/server";
import { isOrgAdmin } from "@/lib/org-access";

// Configurar/sincronizar o ERP mexe com credencial de banco de produção de um
// cliente — restrito a admin, nunca membro comum.
export async function requireOrgAdmin(
  orgId: string,
  userId: string,
): Promise<void> {
  if (!(await isOrgAdmin(orgId, userId))) {
    throw new ORPCError("FORBIDDEN", {
      message: "Apenas administradores podem gerenciar integrações de ERP.",
    });
  }
}
