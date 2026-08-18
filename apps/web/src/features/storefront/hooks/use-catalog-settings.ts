import { orpc } from "@/lib/orpc";
import {
  useMutation,
  usePrefetchQuery,
  useQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";

interface UseCatalogSettingsProps {
  subdomain: string;
}

export function useCatalogSettings({ subdomain }: UseCatalogSettingsProps) {
  const { data, isLoading } = useQuery(
    orpc.catalogSettings.public.queryOptions({
      input: {
        subdomain,
      },
      enabled: !!subdomain,
    }),
  );

  return {
    data: data?.catalogSettings,
    isLoading,
  };
}
export function useCatalogSettingsPrivate() {
  const { data, isLoading } = useQuery(
    orpc.catalogSettings.list.queryOptions(),
  );

  return {
    data: data?.catalogSettings,
    isLoading,
  };
}

export const updateFieldCatalog = () => {
  return useMutation(
    orpc.catalogSettings.update.mutationOptions({
      onSuccess: () => {
        toast("Catálogo atualizado!");
      },
      onError: () => {
        toast("Erro ao atualizar catálogo!");
      },
    }),
  );
};

export function useSuspenseCatalogSettings() {
  const { data } = useSuspenseQuery(orpc.catalogSettings.list.queryOptions());

  return {
    data: data.catalogSettings,
  };
}
