"use client";

import { authClient } from "@/lib/auth-client";
import { isSuperAdmin } from "@/lib/super-admin";

/**
 * Só UX: esconde ou mostra controles. O portão de verdade é no servidor —
 * qualquer procedure que confie nisto está errada.
 */
export function useIsSuperAdmin(): boolean {
  const { data: session } = authClient.useSession();
  return isSuperAdmin(session?.user.email);
}
