"use client";

import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import type { NegotiationStatus } from "@/generated/prisma/enums";
import { useSpaceNegotiations } from "../hooks/use-space-negotiations";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

// timeZone UTC casa com datas gravadas como dia (sem hora), evitando o -1 de fuso.
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });

function formatDate(value: string | null): string | null {
  if (!value) return null;
  return dateFormatter.format(new Date(value));
}

const STATUS_META: Record<
  NegotiationStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  RASCUNHO: { label: "Rascunho", variant: "outline" },
  PROPOSTA: { label: "Proposta", variant: "secondary" },
  FECHADA: { label: "Fechada", variant: "default" },
  CANCELADA: { label: "Cancelada", variant: "destructive" },
};

interface SpaceNegotiationHistoryProps {
  mapObjectId: string | null;
  spaceLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SpaceNegotiationHistory({
  mapObjectId,
  spaceLabel,
  open,
  onOpenChange,
}: SpaceNegotiationHistoryProps) {
  const { negotiations, isLoading } = useSpaceNegotiations(
    open ? mapObjectId : null,
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Últimas negociações · {spaceLabel}</SheetTitle>
        </SheetHeader>

        <div className="space-y-3 px-4 pb-6">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : negotiations.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma negociação registrada ainda.
            </p>
          ) : (
            negotiations.map((negotiation) => {
              const period = [
                formatDate(negotiation.startDate),
                formatDate(negotiation.endDate),
              ].filter(Boolean);
              const statusMeta = STATUS_META[negotiation.status];
              return (
                <div
                  key={negotiation.id}
                  className="space-y-2 rounded-lg border p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      {negotiation.supplierName ?? "Sem indústria"}
                    </span>
                    <Badge variant={statusMeta.variant}>
                      {statusMeta.label}
                    </Badge>
                  </div>
                  {negotiation.brandName && (
                    <p className="text-sm text-muted-foreground">
                      Marca: {negotiation.brandName}
                    </p>
                  )}
                  {negotiation.negotiationTypeName && (
                    <p className="text-sm text-muted-foreground">
                      Tipo: {negotiation.negotiationTypeName}
                    </p>
                  )}
                  {negotiation.distributor && (
                    <p className="text-sm text-muted-foreground">
                      Distribuidor: {negotiation.distributor}
                    </p>
                  )}
                  {period.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {period.join(" a ")}
                    </p>
                  )}
                  {negotiation.amount != null && (
                    <p className="text-sm font-semibold">
                      {currency.format(negotiation.amount)}
                    </p>
                  )}
                  {negotiation.notes && (
                    <p className="text-sm">{negotiation.notes}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {negotiation.createdByName} ·{" "}
                    {dateFormatter.format(new Date(negotiation.createdAt))}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
