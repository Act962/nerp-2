import { SaleStatus } from "@/generated/prisma/enums";
export function getSaleStatusLabel(status: SaleStatus): string {
  const statusMap: Record<SaleStatus, string> = {
    [SaleStatus.DRAFT]: "Rascunho",
    [SaleStatus.PENDING_APPROVAL]: "Aguardando aprovação",
    [SaleStatus.CONFIRMED]: "Confirmado",
    [SaleStatus.PROCESSING]: "Processando",
    [SaleStatus.COMPLETED]: "Concluído",
    [SaleStatus.CANCELLED]: "Cancelado",
  };

  return statusMap[status] || status;
}

export function getSaleStatusVariant(
  status: SaleStatus
): "default" | "secondary" | "success" | "warning" | "destructive" {
  const variantMap: Record<
    SaleStatus,
    "default" | "secondary" | "success" | "warning" | "destructive"
  > = {
    [SaleStatus.DRAFT]: "secondary",
    [SaleStatus.PENDING_APPROVAL]: "warning",
    [SaleStatus.CONFIRMED]: "default",
    [SaleStatus.PROCESSING]: "warning",
    [SaleStatus.COMPLETED]: "success",
    [SaleStatus.CANCELLED]: "destructive",
  };

  return variantMap[status] || "default";
}

export function getSaleStatusBadgeClass(status: SaleStatus): string {
  const classMap: Record<SaleStatus, string> = {
    [SaleStatus.DRAFT]: "bg-gray-100 text-gray-800 border-gray-300",
    [SaleStatus.PENDING_APPROVAL]:
      "bg-amber-100 text-amber-800 border-amber-300",
    [SaleStatus.CONFIRMED]: "bg-blue-100 text-blue-800 border-blue-300",
    [SaleStatus.PROCESSING]: "bg-yellow-100 text-yellow-800 border-yellow-300",
    [SaleStatus.COMPLETED]: "bg-green-100 text-green-800 border-green-300",
    [SaleStatus.CANCELLED]: "bg-red-100 text-red-800 border-red-300",
  };

  return classMap[status] || "";
}
