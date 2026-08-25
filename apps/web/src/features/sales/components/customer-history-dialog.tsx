"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Loader2,
  Receipt,
  ShoppingBag,
  TrendingUp,
  User,
} from "lucide-react";
import { useSalesByCustomer } from "@/features/sales/hooks/use-sales";
import { unitLabel } from "@/features/products/lib/units";
import { cn } from "@/lib/utils";
import type { PaymentMethod, SaleStatus } from "@/generated/prisma/enums";

interface CustomerHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: {
    id: string;
    name: string;
    document?: string | null;
  } | null;
}

const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  DINHEIRO: "Dinheiro",
  CREDITO: "Crédito",
  DEBITO: "Débito",
  PIX: "PIX",
  BOLETO: "Boleto",
  TRANSFERENCIA: "Transferência",
  OUTROS: "Outros",
};

const STATUS_LABELS: Record<SaleStatus, string> = {
  DRAFT: "Rascunho",
  PENDING_APPROVAL: "Aguardando aprovação",
  CONFIRMED: "Confirmada",
  PROCESSING: "Processando",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
};

const STATUS_VARIANT: Record<
  SaleStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  DRAFT: "outline",
  PENDING_APPROVAL: "outline",
  CONFIRMED: "secondary",
  PROCESSING: "secondary",
  COMPLETED: "default",
  CANCELLED: "destructive",
};

export function CustomerHistoryDialog({
  open,
  onOpenChange,
  customer,
}: CustomerHistoryDialogProps) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { summary, sales, isLoading } = useSalesByCustomer({
    customerId: customer?.id,
    from,
    to,
    enabled: open,
  });

  function toggleExpand(saleId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(saleId)) next.delete(saleId);
      else next.add(saleId);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] gap-3 overflow-y-auto sm:max-w-3xl">
        <DialogHeader className="space-y-1">
          <DialogTitle className="flex items-center gap-2">
            <User className="size-5" />
            Histórico de vendas
            {customer && (
              <span className="text-muted-foreground">— {customer.name}</span>
            )}
          </DialogTitle>
          <DialogDescription>
            {customer?.document
              ? `Documento: ${customer.document}`
              : "Vendas realizadas para este cliente"}
          </DialogDescription>
        </DialogHeader>

        {/* Filtro de período */}
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Label htmlFor="hist-from" className="text-xs">
              De
            </Label>
            <Input
              id="hist-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="flex-1">
            <Label htmlFor="hist-to" className="text-xs">
              Até
            </Label>
            <Input
              id="hist-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-9"
            />
          </div>
          {(from || to) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFrom("");
                setTo("");
              }}
            >
              Limpar
            </Button>
          )}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-2">
          <KpiCard
            icon={<ShoppingBag className="size-4" />}
            label="Vendas"
            value={String(summary.salesCount)}
          />
          <KpiCard
            icon={<Receipt className="size-4" />}
            label="Total gasto"
            value={formatBRL(summary.totalSpent)}
          />
          <KpiCard
            icon={<TrendingUp className="size-4" />}
            label="Ticket médio"
            value={formatBRL(summary.averageTicket)}
          />
          <KpiCard
            icon={<Calendar className="size-4" />}
            label="Última venda"
            value={summary.lastSaleAt ? formatDate(summary.lastSaleAt) : "—"}
          />
        </div>

        <Separator />

        {/* Lista de vendas */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : sales.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
            <ShoppingBag className="size-8" />
            <p className="text-sm">
              {customer
                ? "Este cliente ainda não realizou compras no período."
                : "Selecione um cliente"}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col divide-y rounded-md border">
            {sales.map((sale) => {
              const isOpen = expanded.has(sale.id);
              return (
                <li key={sale.id} className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => toggleExpand(sale.id)}
                    className="flex items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-accent"
                  >
                    {isOpen ? (
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">#{sale.saleNumber}</span>
                        <Badge
                          variant={STATUS_VARIANT[sale.status]}
                          className="shrink-0"
                        >
                          {STATUS_LABELS[sale.status]}
                        </Badge>
                        <span className="truncate text-xs text-muted-foreground">
                          {formatDateTime(sale.createdAt)}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {sale.itemsCount}{" "}
                        {sale.itemsCount === 1 ? "item" : "itens"}
                        {" · "}
                        {formatPayments(sale.payments, sale.paymentMethod)}
                      </div>
                    </div>
                    <div
                      className={cn(
                        "font-semibold tabular-nums",
                        sale.status === "CANCELLED" &&
                          "text-muted-foreground line-through",
                      )}
                    >
                      {formatBRL(sale.total)}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t bg-muted/30 px-3 py-3">
                      {/* Itens da venda */}
                      <ul className="flex flex-col gap-1.5 text-sm">
                        {sale.items.map((item) => (
                          <li
                            key={item.id}
                            className="flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium">
                                {item.productName}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {item.sku && `${item.sku} · `}
                                {formatBRL(item.unitPrice)} × {item.quantity}{" "}
                                {unitLabel(item.unit)}
                              </div>
                            </div>
                            <span className="tabular-nums">
                              {formatBRL(item.total)}
                            </span>
                          </li>
                        ))}
                      </ul>

                      {/* Totais + pagamentos */}
                      <Separator className="my-2" />
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="space-y-0.5">
                          <div className="flex justify-between text-muted-foreground">
                            <span>Subtotal</span>
                            <span className="tabular-nums">
                              {formatBRL(sale.subtotal)}
                            </span>
                          </div>
                          {sale.discount > 0 && (
                            <div className="flex justify-between text-success">
                              <span>Desconto</span>
                              <span className="tabular-nums">
                                − {formatBRL(sale.discount)}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between border-t pt-1 font-semibold">
                            <span>Total</span>
                            <span className="tabular-nums">
                              {formatBRL(sale.total)}
                            </span>
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-medium text-muted-foreground">
                            Pagamento
                          </div>
                          {sale.payments.length > 0 ? (
                            <ul className="mt-1 space-y-0.5 text-xs">
                              {sale.payments.map((payment, index) => (
                                <li
                                  key={`${payment.method}-${index}`}
                                  className="flex justify-between"
                                >
                                  <span>{PAYMENT_LABELS[payment.method]}</span>
                                  <span className="tabular-nums">
                                    {formatBRL(payment.amount)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="mt-1 text-xs">
                              {sale.paymentMethod
                                ? PAYMENT_LABELS[sale.paymentMethod]
                                : "—"}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

function KpiCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 truncate text-lg font-semibold tabular-nums">
        {value}
      </div>
    </div>
  );
}

function formatPayments(
  payments: { method: PaymentMethod; amount: number }[],
  fallback: PaymentMethod | null,
) {
  if (payments.length === 0)
    return fallback ? PAYMENT_LABELS[fallback] : "Sem pagamento";
  if (payments.length === 1) return PAYMENT_LABELS[payments[0].method];
  return `Misto (${payments.length})`;
}
