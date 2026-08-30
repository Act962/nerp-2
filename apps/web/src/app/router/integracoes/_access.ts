import { ORPCError } from "@orpc/server";
import { isOrgAdmin } from "@/lib/org-access";

// Instalar integração é gravar credencial de banco de um cliente. Ver o
// catálogo é para qualquer um com a página; gravar, só admin.
export async function requireOrgAdmin(
  orgId: string,
  userId: string,
): Promise<void> {
  if (!(await isOrgAdmin(orgId, userId))) {
    throw new ORPCError("FORBIDDEN", {
      message: "Apenas administradores podem instalar ou remover integrações.",
    });
  }
}
