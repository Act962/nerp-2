"use client";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { currencyFormatter } from "@/utils/currency-formatter";
import { useCaixaMovements } from "../hooks/use-caixa";

type SessionSummary = {
  id: string;
  registerName: string;
  operatorName: string;
  openedAt: string;
};

type MovementKind =
  | "ABERTURA"
  | "SUPRIMENTO"
  | "SANGRIA"
  | "VENDA"
  | "FECHAMENTO"
  | "CANCELAMENTO";

type TimelineItem = {
  id: string;
  kind: MovementKind;
  amount: number;
  createdAt: string;
  detail: string | null;
};

// entrada (+) verde, saída (−) vermelho, cancelamento âmbar, resto neutro/sem sinal.
const KIND_META: Record<
  MovementKind,
  { label: string; sign: "+" | "−" | null; amountClass: string }
> = {
  ABERTURA: { label: "Abertura de caixa", sign: null, amountClass: "" },
  SUPRIMENTO: {
    label: "Suprimento",
    sign: "+",
    amountClass: "text-emerald-600",
  },
  VENDA: { label: "Venda", sign: "+", amountClass: "text-emerald-600" },
  SANGRIA: { label: "Sangria", sign: "−", amountClass: "text-destructive" },
  FECHAMENTO: { label: "Fechamento", sign: null, amountClass: "" },
  CANCELAMENTO: {
    label: "Cancelamento",
    sign: null,
    amountClass: "text-amber-600",
  },
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR");
}

function TimelineRow({ item }: { item: TimelineItem }) {
  const meta = KIND_META[item.kind];
  return (
    <li className="flex items-start justify-between gap-3 py-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn("font-medium", meta.amountClass)}
          >
            {meta.label}
          </Badge>
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatDateTime(item.createdAt)}
          </span>
        </div>
        {item.detail && (
          <span className="text-sm text-muted-foreground">{item.detail}</span>
        )}
      </div>
      <span
        className={cn(
          "shrink-0 text-sm font-semibold tabular-nums",
          meta.amountClass,
        )}
      >
        {meta.sign ? `${meta.sign} ` : ""}
        {currencyFormatter(item.amount)}
      </span>
    </li>
  );
}

export function SessionMovementsDialog({
  session,
  onOpenChange,
}: {
  session: SessionSummary | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isPending } = useCaixaMovements(session?.id ?? null);

  const items: TimelineItem[] = [
    ...(data?.movements ?? []).map((movement) => ({
      id: movement.id,
      kind: movement.type,
      amount: movement.amount,
      createdAt: movement.createdAt,
      detail:
        movement.type === "VENDA" && movement.paymentMethod
          ? movement.paymentMethod
          : movement.description,
    })),
    ...(data?.cancellations ?? []).map((cancellation) => ({
      id: cancellation.id,
      kind: "CANCELAMENTO" as const,
      amount: cancellation.amount,
      createdAt: cancellation.createdAt,
      detail: `${cancellation.productName} · ${cancellation.quantity} un${
        cancellation.approvedByName
          ? ` · por ${cancellation.approvedByName}`
          : ""
      }`,
    })),
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return (
    <Dialog open={!!session} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Movimentações da sessão</DialogTitle>
          {session && (
            <DialogDescription>
              {session.registerName} · {session.operatorName} · aberta em{" "}
              {formatDateTime(session.openedAt)}
            </DialogDescription>
          )}
        </DialogHeader>

        {isPending ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma movimentação nesta sessão.
          </p>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            <ul className="divide-y pr-4">
              {items.map((item) => (
                <TimelineRow key={`${item.kind}-${item.id}`} item={item} />
              ))}
            </ul>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
