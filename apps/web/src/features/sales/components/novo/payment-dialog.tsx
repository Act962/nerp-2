"use client";

import type React from "react";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Banknote,
  CreditCard,
  QrCode,
  Loader2,
  Receipt,
  FileText,
  Printer,
  ArrowLeftRight,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PaymentMethod } from "@/generated/prisma/enums";

export type SalePaymentInput = { method: PaymentMethod; amount: number };

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: number;
  customerName: string | null;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (paymentMethod: PaymentMethod) => void;
  // Abre o dialog de "Selecionar Cliente" a partir daqui — sem fechar este
  // popup. O SelectCustomerDialog vive no pai (create-sale), então o pai é
  // que aciona o `setCustomerDialogOpen(true)`.
  onSelectCustomer?: () => void;
  onConfirm: (data: {
    payments: SalePaymentInput[];
    paymentMethod: PaymentMethod;
    amountPaid: number;
    change: number;
    generateInvoice: boolean;
    printReceipt: boolean;
  }) => void;
}

const PAYMENT_METHODS: {
  id: PaymentMethod;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "DINHEIRO", label: "Dinheiro", icon: Banknote },
  { id: "CREDITO", label: "Crédito", icon: CreditCard },
  { id: "DEBITO", label: "Débito", icon: CreditCard },
  { id: "PIX", label: "PIX", icon: QrCode },
  { id: "BOLETO", label: "Boleto", icon: FileText },
  {
    id: "TRANSFERENCIA",
    label: "Transferência Bancária",
    icon: ArrowLeftRight,
  },
  { id: "OUTROS", label: "Outros", icon: ArrowLeftRight },
];

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function PaymentDialog({
  open,
  onOpenChange,
  total,
  customerName,
  onConfirm,
  onSelectCustomer,
  paymentMethod,
  setPaymentMethod,
}: PaymentDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [amountPaid, setAmountPaid] = useState("");
  const [generateInvoice, setGenerateInvoice] = useState(false);
  const [printReceipt, setPrintReceipt] = useState(true);
  // Modo misto: distribui o total entre várias formas (ex.: 200 no cartão + 300
  // no PIX). Guarda o valor digitado por forma.
  const [mixed, setMixed] = useState(false);
  const [amounts, setAmounts] = useState<
    Partial<Record<PaymentMethod, string>>
  >({});

  const paid = Number.parseFloat(amountPaid) || 0;
  const change = paymentMethod === "DINHEIRO" ? Math.max(0, paid - total) : 0;

  const mixedPayments: SalePaymentInput[] = PAYMENT_METHODS.map((method) => ({
    method: method.id,
    amount: Number.parseFloat(amounts[method.id] ?? "") || 0,
  })).filter((payment) => payment.amount > 0);
  const mixedPaid = mixedPayments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = total - mixedPaid;

  const canFinish = mixed
    ? Math.abs(remaining) < 0.01
    : paymentMethod === "DINHEIRO"
      ? paid >= total
      : true;

  const formRef = useRef<HTMLFormElement>(null);

  // Atalhos dentro do diálogo: dígitos 1..N escolhem a forma (forma única) e
  // Enter confirma. Só valem fora de um campo de texto, para não atrapalhar a
  // digitação de valores.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const inInput =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA");
      if (inInput) return;
      if (event.key === "Enter" && canFinish) {
        event.preventDefault();
        formRef.current?.requestSubmit();
        return;
      }
      if (mixed) return;
      const digit = Number.parseInt(event.key, 10);
      if (
        !Number.isNaN(digit) &&
        digit >= 1 &&
        digit <= PAYMENT_METHODS.length
      ) {
        event.preventDefault();
        setPaymentMethod(PAYMENT_METHODS[digit - 1].id);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, mixed, canFinish, setPaymentMethod]);

  const reset = () => {
    setAmountPaid("");
    setGenerateInvoice(false);
    setPrintReceipt(true);
    setMixed(false);
    setAmounts({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canFinish) return;
    setIsLoading(true);

    if (mixed) {
      // A forma predominante (maior valor) vira o resumo rápido da venda.
      const dominant = [...mixedPayments].sort(
        (a, b) => b.amount - a.amount,
      )[0];
      onConfirm({
        payments: mixedPayments,
        paymentMethod: dominant?.method ?? paymentMethod,
        amountPaid: mixedPaid,
        change: 0,
        generateInvoice,
        printReceipt,
      });
    } else {
      onConfirm({
        payments: [{ method: paymentMethod, amount: total }],
        paymentMethod,
        amountPaid: paymentMethod === "DINHEIRO" ? paid : total,
        change,
        generateInvoice,
        printReceipt,
      });
    }

    setIsLoading(false);
    reset();
    onOpenChange(false);
  };

  const quickAmounts = [50, 100, 200, 500];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] gap-3 overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="space-y-1">
          <DialogTitle>Finalizar Venda</DialogTitle>
          <DialogDescription asChild>
            {customerName ? (
              <span>Cliente: {customerName}</span>
            ) : (
              <span className="flex items-center gap-2">
                <span>Venda sem cliente identificado</span>
                {onSelectCustomer && (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={onSelectCustomer}
                  >
                    <UserPlus className="mr-1 h-3 w-3" />
                    Adicionar cliente
                  </Button>
                )}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} onSubmit={handleSubmit}>
          <div className="space-y-3">
            {/* Total + toggle misto lado a lado — economiza altura. */}
            <div className="grid grid-cols-[1fr_auto] items-center gap-3">
              <div className="rounded-lg border bg-primary/5 px-4 py-2">
                <p className="text-xs text-muted-foreground">Total a Pagar</p>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(total)}
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                <Switch id="mixed" checked={mixed} onCheckedChange={setMixed} />
                <Label htmlFor="mixed" className="cursor-pointer text-sm">
                  Pagto. misto
                </Label>
              </div>
            </div>

            {mixed ? (
              <div className="space-y-3">
                <Label>Distribua o valor por forma</Label>
                <div className="space-y-2">
                  {PAYMENT_METHODS.map((method) => (
                    <div key={method.id} className="flex items-center gap-2">
                      <span className="flex w-40 items-center gap-2 text-sm">
                        <method.icon className="h-4 w-4 text-muted-foreground" />
                        {method.label}
                      </span>
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          R$
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          inputMode="decimal"
                          placeholder="0,00"
                          className="pl-9"
                          value={amounts[method.id] ?? ""}
                          onChange={(event) =>
                            setAmounts((current) => ({
                              ...current,
                              [method.id]: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={remaining <= 0}
                        onClick={() =>
                          setAmounts((current) => {
                            const currentAmount =
                              Number.parseFloat(current[method.id] ?? "") || 0;
                            return {
                              ...current,
                              [method.id]: String(
                                Number((currentAmount + remaining).toFixed(2)),
                              ),
                            };
                          })
                        }
                      >
                        Restante
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="space-y-1 rounded-lg border p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total pago</span>
                    <span className="font-medium tabular-nums">
                      {formatCurrency(mixedPaid)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {remaining >= 0 ? "Falta pagar" : "Excedente"}
                    </span>
                    <span
                      className={cn(
                        "font-semibold tabular-nums",
                        Math.abs(remaining) < 0.01
                          ? "text-success"
                          : "text-destructive",
                      )}
                    >
                      {formatCurrency(Math.abs(remaining))}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Forma única */}
                <div className="space-y-3">
                  <Label>Forma de Pagamento</Label>
                  <RadioGroup
                    value={paymentMethod}
                    onValueChange={(value) =>
                      setPaymentMethod(value as PaymentMethod)
                    }
                    className="grid grid-cols-3 gap-2"
                  >
                    {PAYMENT_METHODS.map((method, index) => (
                      <div key={method.id}>
                        <RadioGroupItem
                          value={method.id}
                          id={method.id}
                          className="peer sr-only"
                        />
                        <Label
                          htmlFor={method.id}
                          className={cn(
                            "flex items-center justify-center gap-2 rounded-lg border-2 border-muted bg-popover p-3 cursor-pointer transition-all hover:bg-accent",
                            paymentMethod === method.id &&
                              "border-primary bg-primary/5",
                          )}
                        >
                          <kbd className="flex size-5 shrink-0 items-center justify-center rounded border bg-muted font-mono text-[10px]">
                            {index + 1}
                          </kbd>
                          <method.icon
                            className={cn(
                              "h-4 w-4",
                              paymentMethod === method.id && "text-primary",
                            )}
                          />
                          <span className="text-sm font-medium">
                            {method.label}
                          </span>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                {/* Valor recebido (só dinheiro) */}
                {paymentMethod === "DINHEIRO" && (
                  <div className="space-y-3">
                    <Label htmlFor="amountPaid">Valor Recebido</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        R$
                      </span>
                      <Input
                        id="amountPaid"
                        type="number"
                        step="0.01"
                        min={total}
                        placeholder="0,00"
                        className="pl-10 text-lg"
                        value={amountPaid}
                        onChange={(e) => setAmountPaid(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {quickAmounts.map((amount) => (
                        <Button
                          key={amount}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setAmountPaid(String(amount))}
                        >
                          {formatCurrency(amount)}
                        </Button>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setAmountPaid(String(total))}
                      >
                        Valor exato
                      </Button>
                    </div>

                    {paid >= total && (
                      <div className="rounded-lg border bg-success/10 p-3 text-center">
                        <p className="text-sm text-muted-foreground">Troco</p>
                        <p className="text-xl font-bold text-success">
                          {formatCurrency(change)}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            <Separator />

            {/* Options lado a lado — economiza altura. */}
            <div className="grid grid-cols-2 gap-2">
              <label
                htmlFor="generateInvoice"
                className="flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm hover:bg-accent"
              >
                <Checkbox
                  id="generateInvoice"
                  checked={generateInvoice}
                  onCheckedChange={(checked) =>
                    setGenerateInvoice(checked as boolean)
                  }
                />
                <FileText className="h-4 w-4" />
                Gerar Nota Fiscal (NF-e)
              </label>
              <label
                htmlFor="printReceipt"
                className="flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm hover:bg-accent"
              >
                <Checkbox
                  id="printReceipt"
                  checked={printReceipt}
                  onCheckedChange={(checked) =>
                    setPrintReceipt(checked as boolean)
                  }
                />
                <Printer className="h-4 w-4" />
                Imprimir Cupom
              </label>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !canFinish}
              className="gap-2"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Receipt className="h-4 w-4" />
              )}
              Confirmar Pagamento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
