import "server-only";

import { hasFullAccess, memberCan } from "@/lib/permissions";

// Quem pode autorizar cancelamentos: owner/admin ou a permissão dedicada.
export function isAuthorizer(
  member: { role: string; permissions: string[] } | null | undefined,
): boolean {
  if (!member) return false;
  return (
    hasFullAccess(member.role) || memberCan(member, "autorizar-cancelamento")
  );
}
