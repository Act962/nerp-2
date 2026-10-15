"use client";

import { Warehouse } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useErpSyncStatus } from "../hooks/use-erp-sync";

/** De qual filial do ERP vem o estoque mostrado (spec erp-sync-estoque-preco-winthor). Sem filial escolhida, nada. */
export function ErpStockBranchBadge() {
  const { data: status } = useErpSyncStatus();
  if (!status?.configured || !status.stockBranchCode) return null;
  const branch = status.stockBranches.find(
    (option) => option.code === status.stockBranchCode,
  );
  return (
    <Badge
      variant="outline"
      className="shrink-0 gap-1"
      title="Estoque sincronizado do Winthor. Troque a filial em Integrações → Winthor."
    >
      <Warehouse className="size-3" />
      Estoque da filial {status.stockBranchCode}
      {branch?.name ? ` · ${branch.name}` : ""}
    </Badge>
  );
}
