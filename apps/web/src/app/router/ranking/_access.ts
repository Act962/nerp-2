import { ORPCError } from "@orpc/server";
import { getMemberRole, isOrgAdmin } from "@/lib/org-access";

export { getMemberRole, isOrgAdmin };

export async function requireOrgAdmin(
  orgId: string,
  userId: string,
): Promise<void> {
  if (!(await isOrgAdmin(orgId, userId))) {
    throw new ORPCError("FORBIDDEN", {
      message:
        "Apenas administradores podem executar esta operação no ranking.",
    });
  }
}
