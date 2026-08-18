import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import type { TradeCatalogStatus } from "@/generated/prisma/enums";
import { TRADE_CATALOG_STATUS_META } from "../lib/catalog-format";

export function CatalogStatusBadge({ status }: { status: TradeCatalogStatus }) {
  const meta = TRADE_CATALOG_STATUS_META[status];
  return (
    <Badge variant={meta.variant} className="gap-1">
      {status === "GENERATING" && <Spinner className="size-3" />}
      {meta.label}
    </Badge>
  );
}
