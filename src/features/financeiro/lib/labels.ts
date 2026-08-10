import type {
  AccountType,
  CategoryType,
  ContactType,
  EntryStatus,
  EntryType,
} from "@/features/financeiro/lib/types";

export const ENTRY_TYPE_LABEL: Record<EntryType, string> = {
  RECEIVABLE: "A receber",
  PAYABLE: "A pagar",
};

export const STATUS_LABEL: Record<EntryStatus, string> = {
  PENDING_APPROVAL: "Aguardando aprovação",
  PENDING: "Pendente",
  PARTIAL: "Parcial",
  PAID: "Pago",
  OVERDUE: "Vencido",
  CANCELLED: "Cancelado",
};

// Variantes do <Badge> conforme o status do lançamento.
type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

export function statusBadgeVariant(
  status: EntryStatus,
  overdue: boolean,
): BadgeVariant {
  if (status === "PAID") return "default";
  if (status === "CANCELLED") return "outline";
  if (overdue || status === "OVERDUE") return "destructive";
  return "secondary";
}

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  CHECKING: "Conta corrente",
  SAVINGS: "Poupança",
  CASH: "Dinheiro",
  DIGITAL: "Digital",
};

export const CATEGORY_TYPE_LABEL: Record<CategoryType, string> = {
  REVENUE: "Receita",
  EXPENSE: "Despesa",
  COST: "Custo",
};

export const CONTACT_TYPE_LABEL: Record<ContactType, string> = {
  CUSTOMER: "Cliente",
  SUPPLIER: "Fornecedor",
  BOTH: "Ambos",
};
