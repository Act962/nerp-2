"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type CompanyType = "SUPERMERCADO" | "INDUSTRIA" | "DISTRIBUIDOR";
type ClaimedFilter = "all" | "claimed" | "unclaimed";

export function useDirectorySearch(filters: {
  q?: string;
  type?: CompanyType;
  claimed?: ClaimedFilter;
}) {
  return useQuery(
    orpc.directory.search.queryOptions({
      input: {
        q: filters.q || undefined,
        type: filters.type,
        claimed: filters.claimed ?? "all",
      },
    }),
  );
}

export function useMyCompanies() {
  return useQuery(orpc.directory.myCompanies.queryOptions({ input: {} }));
}

function useInvalidateDirectory() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: orpc.directory.search.key() });
    queryClient.invalidateQueries({
      queryKey: orpc.directory.myCompanies.key(),
    });
  };
}

export function useCreateDirectoryCompany() {
  const invalidate = useInvalidateDirectory();
  return useMutation(
    orpc.directory.create.mutationOptions({ onSuccess: invalidate }),
  );
}

export function useClaimDirectoryCompany() {
  const invalidate = useInvalidateDirectory();
  return useMutation(
    orpc.directory.claim.mutationOptions({ onSuccess: invalidate }),
  );
}
