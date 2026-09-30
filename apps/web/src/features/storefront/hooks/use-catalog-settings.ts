import { orpc } from "@/lib/orpc";
import {
  useMutation,
  usePrefetchQuery,
  useQueryClient,
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
    ofertas: data?.ofertas ?? [],
    isLoading,
  };
}
export function useCatalogSettingsPrivate() {
  const { data, isLoading, isError } = useQuery(
    orpc.catalogSettings.list.queryOptions(),
  );

  return {
    data: data?.catalogSettings,
    isLoading,
    isError,
  };
}

export function useCriarCatalogo() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.catalogSettings.create.mutationOptions({
      onSuccess: () => {
        toast.success("Catálogo criado");
        queryClient.invalidateQueries({
          queryKey: orpc.catalogSettings.list.key(),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
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
