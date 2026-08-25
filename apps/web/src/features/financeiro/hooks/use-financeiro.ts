import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { EntryStatus, EntryType } from "@/features/financeiro/lib/types";

// ---------------------------------------------------------------------------
// Dashboard / fluxo de caixa
// ---------------------------------------------------------------------------

export function useDashboard() {
  return useQuery(
    orpc.financeiro.dashboard.get.queryOptions({ input: undefined }),
  );
}

export function useCashflow(from: string, to: string) {
  return useQuery(
    orpc.financeiro.dashboard.cashflow.queryOptions({
      input: { from, to },
      enabled: Boolean(from && to),
    }),
  );
}

// DRE por competência (Receita − Custo − Despesa = Resultado).
export function useDre(from: string, to: string) {
  return useQuery(
    orpc.financeiro.reports.dre.queryOptions({
      input: { from, to },
      enabled: Boolean(from && to),
    }),
  );
}

// DRO: resultado operacional × não-operacional (pela flag da categoria).
export function useDro(from: string, to: string) {
  return useQuery(
    orpc.financeiro.reports.dro.queryOptions({
      input: { from, to },
      enabled: Boolean(from && to),
    }),
  );
}

// ---------------------------------------------------------------------------
// Lançamentos
// ---------------------------------------------------------------------------

interface EntriesFilters {
  type?: EntryType;
  status?: EntryStatus;
  search?: string;
  onlyOverdue?: boolean;
  contactId?: string;
  categoryId?: string;
  accountId?: string;
}

export function useEntries(filters: EntriesFilters = {}) {
  return useQuery(
    orpc.financeiro.entries.list.queryOptions({
      input: { limit: 100, ...filters },
    }),
  );
}

function useInvalidateEntries() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({
      queryKey: orpc.financeiro.entries.list.key(),
    });
    queryClient.invalidateQueries({
      queryKey: orpc.financeiro.dashboard.get.key(),
    });
    queryClient.invalidateQueries({
      queryKey: orpc.financeiro.dashboard.cashflow.key(),
    });
    queryClient.invalidateQueries({
      queryKey: orpc.financeiro.accounts.list.key(),
    });
  };
}

export function useCreateEntry() {
  const invalidate = useInvalidateEntries();
  return useMutation(
    orpc.financeiro.entries.create.mutationOptions({
      onSuccess: () => {
        toast.success("Lançamento criado");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useUpdateEntry() {
  const invalidate = useInvalidateEntries();
  return useMutation(
    orpc.financeiro.entries.update.mutationOptions({
      onSuccess: () => {
        toast.success("Lançamento atualizado");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function usePayEntry() {
  const invalidate = useInvalidateEntries();
  return useMutation(
    orpc.financeiro.entries.pay.mutationOptions({
      onSuccess: () => {
        toast.success("Baixa registrada");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useCancelEntry() {
  const invalidate = useInvalidateEntries();
  return useMutation(
    orpc.financeiro.entries.cancel.mutationOptions({
      onSuccess: () => {
        toast.success("Lançamento cancelado");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useDeleteEntry() {
  const invalidate = useInvalidateEntries();
  return useMutation(
    orpc.financeiro.entries.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Lançamento excluído");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

// ---------------------------------------------------------------------------
// Contas bancárias
// ---------------------------------------------------------------------------

export function useAccounts(includeInactive = false) {
  return useQuery(
    orpc.financeiro.accounts.list.queryOptions({ input: { includeInactive } }),
  );
}

function useInvalidateAccounts() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({
      queryKey: orpc.financeiro.accounts.list.key(),
    });
    queryClient.invalidateQueries({
      queryKey: orpc.financeiro.dashboard.get.key(),
    });
  };
}

export function useCreateAccount() {
  const invalidate = useInvalidateAccounts();
  return useMutation(
    orpc.financeiro.accounts.create.mutationOptions({
      onSuccess: () => {
        toast.success("Conta criada");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useUpdateAccount() {
  const invalidate = useInvalidateAccounts();
  return useMutation(
    orpc.financeiro.accounts.update.mutationOptions({
      onSuccess: () => {
        toast.success("Conta atualizada");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useDeleteAccount() {
  const invalidate = useInvalidateAccounts();
  return useMutation(
    orpc.financeiro.accounts.delete.mutationOptions({
      onSuccess: (data) => {
        toast.success(data.deactivated ? "Conta desativada" : "Conta excluída");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------

export function useCategories(includeInactive = false) {
  return useQuery(
    orpc.financeiro.categories.list.queryOptions({
      input: { includeInactive },
    }),
  );
}

function useInvalidateCategories() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      queryKey: orpc.financeiro.categories.list.key(),
    });
}

export function useCreateCategory() {
  const invalidate = useInvalidateCategories();
  return useMutation(
    orpc.financeiro.categories.create.mutationOptions({
      onSuccess: () => {
        toast.success("Categoria criada");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useUpdateCategory() {
  const invalidate = useInvalidateCategories();
  return useMutation(
    orpc.financeiro.categories.update.mutationOptions({
      onSuccess: () => {
        toast.success("Categoria atualizada");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useDeleteCategory() {
  const invalidate = useInvalidateCategories();
  return useMutation(
    orpc.financeiro.categories.delete.mutationOptions({
      onSuccess: (data) => {
        toast.success(
          data.deactivated ? "Categoria desativada" : "Categoria excluída",
        );
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

// ---------------------------------------------------------------------------
// Centros de custo
// ---------------------------------------------------------------------------

export function useCostCenters(includeInactive = false) {
  return useQuery(
    orpc.financeiro.costCenters.list.queryOptions({
      input: { includeInactive },
    }),
  );
}

function useInvalidateCostCenters() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      queryKey: orpc.financeiro.costCenters.list.key(),
    });
}

export function useCreateCostCenter() {
  const invalidate = useInvalidateCostCenters();
  return useMutation(
    orpc.financeiro.costCenters.create.mutationOptions({
      onSuccess: () => {
        toast.success("Centro de custo criado");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useUpdateCostCenter() {
  const invalidate = useInvalidateCostCenters();
  return useMutation(
    orpc.financeiro.costCenters.update.mutationOptions({
      onSuccess: () => {
        toast.success("Centro de custo atualizado");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useDeleteCostCenter() {
  const invalidate = useInvalidateCostCenters();
  return useMutation(
    orpc.financeiro.costCenters.delete.mutationOptions({
      onSuccess: (data) => {
        toast.success(
          data.deactivated
            ? "Centro de custo desativado"
            : "Centro de custo excluído",
        );
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

// ---------------------------------------------------------------------------
// Contatos
// ---------------------------------------------------------------------------

export function useContacts(search?: string) {
  return useQuery(
    orpc.financeiro.contacts.list.queryOptions({
      input: search ? { search } : {},
    }),
  );
}

function useInvalidateContacts() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      queryKey: orpc.financeiro.contacts.list.key(),
    });
}

export function useCreateContact() {
  const invalidate = useInvalidateContacts();
  return useMutation(
    orpc.financeiro.contacts.create.mutationOptions({
      onSuccess: () => {
        toast.success("Contato criado");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useUpdateContact() {
  const invalidate = useInvalidateContacts();
  return useMutation(
    orpc.financeiro.contacts.update.mutationOptions({
      onSuccess: () => {
        toast.success("Contato atualizado");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useDeleteContact() {
  const invalidate = useInvalidateContacts();
  return useMutation(
    orpc.financeiro.contacts.delete.mutationOptions({
      onSuccess: (data) => {
        toast.success(
          data.deactivated ? "Contato desativado" : "Contato excluído",
        );
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}
