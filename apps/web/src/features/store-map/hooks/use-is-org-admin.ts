"use client";

import { orpc } from "@/lib/orpc";
import { hasFullAccess } from "@/lib/permissions";
import { useQuery } from "@tanstack/react-query";

// Owner/admin veem as ações de edição no menu do espaço; o promotor não.
export function useIsOrgAdmin(): boolean {
  const { data } = useQuery(orpc.members.getCurrent.queryOptions({ input: {} }));
  return hasFullAccess(data?.role);
}
