import type { TradeCatalogStatus } from "@/generated/prisma/enums";

interface StatusMeta {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
}

export const TRADE_CATALOG_STATUS_META: Record<TradeCatalogStatus, StatusMeta> = {
  DRAFT: { label: "Rascunho", variant: "secondary" },
  GENERATING: { label: "Gerando", variant: "outline" },
  READY: { label: "Pronto", variant: "default" },
  FAILED: { label: "Falhou", variant: "destructive" },
};
