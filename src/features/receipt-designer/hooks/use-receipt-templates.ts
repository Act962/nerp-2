"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useReceiptTemplates() {
  return useQuery(orpc.receiptTemplate.list.queryOptions({ input: undefined }));
}

export function useReceiptDefaultTemplate() {
  return useQuery(
    orpc.receiptTemplate.getDefault.queryOptions({ input: undefined }),
  );
}

function useInvalidateReceiptTemplates() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({
      queryKey: orpc.receiptTemplate.list.key(),
    });
    queryClient.invalidateQueries({
      queryKey: orpc.receiptTemplate.getDefault.key(),
    });
  };
}

export function useCreateReceiptTemplate() {
  const invalidate = useInvalidateReceiptTemplates();
  return useMutation(
    orpc.receiptTemplate.create.mutationOptions({
      onSuccess: () => {
        toast.success("Template criado");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useUpdateReceiptTemplate() {
  const invalidate = useInvalidateReceiptTemplates();
  return useMutation(
    orpc.receiptTemplate.update.mutationOptions({
      onSuccess: () => {
        toast.success("Template salvo");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useSetDefaultReceiptTemplate() {
  const invalidate = useInvalidateReceiptTemplates();
  return useMutation(
    orpc.receiptTemplate.setDefault.mutationOptions({
      onSuccess: () => {
        toast.success("Template padrão definido");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useDeleteReceiptTemplate() {
  const invalidate = useInvalidateReceiptTemplates();
  return useMutation(
    orpc.receiptTemplate.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Template excluído");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}
