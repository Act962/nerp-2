"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useMembers() {
  const { data, isPending } = useQuery(
    orpc.members.list.queryOptions({ input: {} }),
  );
  return { members: data ?? [], isLoading: isPending };
}

export function useCurrentMember() {
  const { data, isPending } = useQuery(
    orpc.members.getCurrent.queryOptions({ input: {} }),
  );
  return { member: data ?? null, isLoading: isPending };
}

function useInvalidateMembers() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: orpc.members.list.key() });
    queryClient.invalidateQueries({ queryKey: orpc.members.getCurrent.key() });
  };
}

export function useUpdateMemberRole() {
  const invalidate = useInvalidateMembers();
  return useMutation(
    orpc.members.updateRole.mutationOptions({
      onSuccess: () => {
        toast.success("Cargo atualizado!");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useRemoveMember() {
  const invalidate = useInvalidateMembers();
  return useMutation(
    orpc.members.remove.mutationOptions({
      onSuccess: () => {
        toast.success("Membro removido da organização.");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useUpdateMemberPermissions() {
  const invalidate = useInvalidateMembers();
  return useMutation(
    orpc.members.updatePermissions.mutationOptions({
      onSuccess: () => {
        toast.success("Permissões atualizadas!");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

// Silencioso: o usuário liga/desliga vários módulos seguidos e um toast por
// switch empilharia na tela.
export function useUpdateMyModules() {
  const invalidate = useInvalidateMembers();
  return useMutation(
    orpc.members.updateMyModules.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (error) => {
        toast.error(error.message);
        invalidate();
      },
    }),
  );
}

export function useUpdateOrgDisabledModules() {
  const invalidate = useInvalidateMembers();
  return useMutation(
    orpc.org.updateDisabledModules.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (error) => {
        toast.error(error.message);
        invalidate();
      },
    }),
  );
}

export function useUpdateMemberSupervisor() {
  const invalidate = useInvalidateMembers();
  return useMutation(
    orpc.members.updateSupervisor.mutationOptions({
      onSuccess: () => {
        toast.success("Supervisor atualizado!");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useUpdateMemberTradeRole() {
  const invalidate = useInvalidateMembers();
  return useMutation(
    orpc.members.updateTradeRole.mutationOptions({
      onSuccess: () => {
        toast.success("Cargo no Trade atualizado!");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

// Silencioso como o de módulos: o admin costuma alternar vários seguidos.
export function useUpdateMemberPromotorVisibility() {
  const invalidate = useInvalidateMembers();
  return useMutation(
    orpc.members.updatePromotorVisibility.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (error) => {
        toast.error(error.message);
        invalidate();
      },
    }),
  );
}

export function useSetMemberSupplierLinks() {
  const invalidate = useInvalidateMembers();
  return useMutation(
    orpc.members.setSupplierLinks.mutationOptions({
      onSuccess: () => {
        toast.success("Indústrias salvas!");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}
