"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type ExpiryUnit,
  useExpiringNegotiations,
} from "@/features/store-map/hooks/use-space-negotiations";
import { CalendarClock, MapPin } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const UNIT_OPTIONS: { value: ExpiryUnit; label: string; default: number }[] = [
  { value: "days", label: "Dias", default: 30 },
  { value: "months", label: "Meses", default: 3 },
  { value: "years", label: "Anos", default: 1 },
];

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function remainingLabel(days: number) {
  if (days <= 0) return "vence hoje";
  if (days === 1) return "falta 1 dia";
  return `faltam ${days} dias`;
}

function remainingTone(days: number) {
  if (days <= 7) return "border-red-300 bg-red-50 text-red-700";
  if (days <= 30) return "border-amber-300 bg-amber-50 text-amber-700";
  return "border-muted bg-muted text-muted-foreground";
}

export function ExpiringNegotiationsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [unit, setUnit] = useState<ExpiryUnit>("days");
  const [amount, setAmount] = useState(30);
  const { data, isLoading } = useExpiringNegotiations(unit, amount, open);

  const selectUnit = (next: ExpiryUnit) => {
    setUnit(next);
    setAmount(
      UNIT_OPTIONS.find((option) => option.value === next)?.default ?? 1,
    );
  };

  const negotiations = data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] gap-4 overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="size-5" /> Negociações próximas do
            vencimento
          </DialogTitle>
          <DialogDescription>
            Negociações fechadas que terminam dentro da janela escolhida.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-sm">
            Vencendo nos próximos
          </span>
          <Input
            type="number"
            min={1}
            max={999}
            value={amount}
            onChange={(event) =>
              setAmount(Math.max(1, Number(event.target.value) || 1))
            }
            className="h-9 w-20"
          />
          <div className="inline-flex rounded-md border p-0.5">
            {UNIT_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={unit === option.value ? "secondary" : "ghost"}
                className="h-8"
                onClick={() => selectUnit(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : negotiations.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground text-sm">
              Nenhuma negociação vencendo nesta janela.
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs">
                {negotiations.length}{" "}
                {negotiations.length === 1 ? "negociação" : "negociações"} nesta
                janela
              </p>
              {negotiations.map((negotiation) => (
                <div
                  key={negotiation.id}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-lg border p-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {negotiation.spaceLabel}
                      </span>
                      {negotiation.spaceCode && (
                        <span className="text-muted-foreground text-xs">
                          {negotiation.spaceCode}
                        </span>
                      )}
                    </div>
                    <Link
                      href={`/mapa/${negotiation.storeId}`}
                      className="inline-flex items-center gap-1 text-muted-foreground text-xs hover:underline"
                    >
                      <MapPin className="size-3" /> {negotiation.storeName}
                    </Link>
                    <div className="text-muted-foreground text-xs">
                      {negotiation.supplierName ??
                        negotiation.distributor ??
                        "Sem indústria"}
                      {negotiation.negotiationTypeName
                        ? ` · ${negotiation.negotiationTypeName}`
                        : ""}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge
                      variant="outline"
                      className={`whitespace-nowrap ${remainingTone(negotiation.daysRemaining)}`}
                    >
                      {remainingLabel(negotiation.daysRemaining)}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      até {formatDate(negotiation.endDate)}
                    </span>
                    {negotiation.amount !== null && (
                      <span className="font-medium text-sm tabular-nums">
                        {formatCurrency(negotiation.amount)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
