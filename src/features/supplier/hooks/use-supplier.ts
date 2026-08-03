import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PersonType } from "@/generated/prisma/enums";
import { toast } from "sonner";

interface UseSupplierProps {
  personType?: PersonType;
  search?: string;
  page?: number;
  pageSize?: number;
}

export function useSupplier({
  personType,
  search,
  page = 1,
  pageSize = 10,
}: UseSupplierProps = {}) {
  const { data, isPending } = useQuery(
    orpc.supplier.list.queryOptions({
      input: { personType, search, page, pageSize },
    }),
  );

  return {
    suppliers: data?.suppliers || [],
    totalCount: data?.totalCount ?? 0,
    page: data?.page ?? page,
    pageSize: data?.pageSize ?? pageSize,
    totalPages: data?.totalPages ?? 1,
    isLoading: isPending,
  };
}

export const useQuerySupplier = (id: string) => {
  const { data, isPending } = useQuery(
    orpc.supplier.getOne.queryOptions({
      input: { id },
      // Os três diálogos (ver, editar, excluir) ficam montados o tempo todo com
      // `id: ""` até alguém clicar numa linha. Sem esta guarda, cada carregamento
      // da lista dispara três buscas fadadas a 404 e enche o log do servidor de
      // "Fornecedor não encontrado" que não é erro de ninguém.
      enabled: id.length > 0,
    }),
  );

  return {
    supplier: data?.supplier,
    isLoading: isPending,
  };
};

export const useCreateSupplier = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.supplier.create.mutationOptions({
      onSuccess: () => {
        toast.success("Fornecedor criado com sucesso");
        queryClient.invalidateQueries({
          queryKey: orpc.supplier.list.key(),
        });
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );
};

export const useUpdateSupplier = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.supplier.update.mutationOptions({
      onSuccess: (data) => {
        toast.success("Fornecedor atualizado com sucesso");
        queryClient.invalidateQueries({
          queryKey: orpc.supplier.list.key(),
        });
        queryClient.invalidateQueries(
          orpc.supplier.getOne.queryOptions({
            input: { id: data.supplier.id },
          }),
        );
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );
};

export const useDeleteSupplier = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.supplier.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Fornecedor deletado com sucesso");
        queryClient.invalidateQueries({
          queryKey: orpc.supplier.list.key(),
        });
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );
};
