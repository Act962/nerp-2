import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PersonType } from "@/generated/prisma/enums";
import { toast } from "sonner";

interface UseCustomerProps {
  personType?: PersonType;
  minPurchase?: number;
  maxPurchase?: number;
  dateIni?: Date;
  dateEnd?: Date;
}

export function useCustomer({
  personType,
  minPurchase,
  maxPurchase,
  dateIni,
  dateEnd,
}: UseCustomerProps) {
  const { data, isPending } = useQuery(
    orpc.customer.list.queryOptions({
      input: {
        personType,
        minPurchase,
        maxPurchase,
        dateIni,
        dateEnd,
      },
    })
  );

  return {
    customers: data?.customers || [],
    isLoading: isPending,
  };
}

export const useQueryCustomer = (id: string) => {
  const { data, isPending } = useQuery(
    orpc.customer.getOne.queryOptions({
      input: {
        id,
      },
    })
  );

  return {
    customer: data?.customer,
    isLoading: isPending,
  };
};

/// Mutations

export const useCreateCustomer = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.customer.create.mutationOptions({
      onSuccess: () => {
        toast.success("Cliente criado com sucesso");
        queryClient.invalidateQueries(
          orpc.customer.list.queryOptions({
            input: {},
          })
        );
      },
      onError: (error) => {
        toast.error(error.message);
      },
    })
  );
};

export const useUpdateCustomer = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.customer.update.mutationOptions({
      onSuccess: (data) => {
        toast.success("Cliente atualizado com sucesso");
        queryClient.invalidateQueries(
          orpc.customer.list.queryOptions({
            input: {},
          })
        );
        queryClient.invalidateQueries(
          orpc.customer.getOne.queryOptions({
            input: {
              id: data.customer.id,
            },
          })
        );
      },
      onError: (error) => {
        toast.error(error.message);
      },
    })
  );
};

export const useDeleteCustomer = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.customer.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Cliente deletado com sucesso");
        queryClient.invalidateQueries(
          orpc.customer.list.queryOptions({
            input: {},
          })
        );
      },
      onError: (error) => {
        toast.error(error.message);
      },
    })
  );
};
