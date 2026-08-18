import { orpc } from "@/lib/orpc";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

interface userCatalogProps {
  email: string;
  subdomain: string;
}

export function useCustomer({ email, subdomain }: userCatalogProps) {
  const { data, isLoading } = useQuery(
    orpc.catalogSettings.getUser.queryOptions({
      input: {
        email,
        subdomain,
      },
    })
  );
  return { data, isLoading };
}

export function updateCustomer() {
  return useMutation(
    orpc.catalogSettings.updateCustomer.mutationOptions({
      onSuccess: () => {
        toast("Informações atualizadas!");
      },
      onError: () => {
        toast("Erro ao atualizar informações!");
      },
    })
  );
}
