"use client";

import { authClient } from "@/lib/auth-client";
import { ehDaEquipeDoMapeamento } from "../equipe";

/**
 * Só UX: mostra ou esconde o atalho para o mapeamento. O portão de verdade é
 * `podeMapearBanco`, na página e nas procedures.
 */
export function useEhDaEquipeDoMapeamento(): boolean {
  const { data: session } = authClient.useSession();
  return ehDaEquipeDoMapeamento(session?.user.email);
}
