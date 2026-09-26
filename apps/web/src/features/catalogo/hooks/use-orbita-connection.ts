import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export function useOrbitaConnection({
  enabled = true,
}: {
  enabled?: boolean;
} = {}) {
  const { data, isLoading } = useQuery(
    orpc.catalogSettings.orbitaConnection.queryOptions({ enabled }),
  );

  return {
    orbitaConnected: data?.orbitaConnected ?? false,
    isLoading,
  };
}
