import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type Collaborator = {
  id: string;
  name: string;
  role: string;
  photoUrl: string | null;
  isActive: boolean;
  createdAt: string;
};

export function useQueryCollaborators(onlyActive = false) {
  return useQuery(
    orpc.collaborators.list.queryOptions({ input: { onlyActive } }),
  );
}

export function useMutationCreateCollaborator() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.collaborators.create.mutationOptions({
      onSuccess: () => {
        toast.success("Colaborador cadastrado!");
        queryClient.invalidateQueries({
          queryKey: orpc.collaborators.list.key(),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useMutationUpdateCollaborator() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.collaborators.update.mutationOptions({
      onSuccess: () => {
        toast.success("Colaborador atualizado!");
        queryClient.invalidateQueries({
          queryKey: orpc.collaborators.list.key(),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useMutationDeleteCollaborator() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.collaborators.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Colaborador excluído!");
        queryClient.invalidateQueries({
          queryKey: orpc.collaborators.list.key(),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}
