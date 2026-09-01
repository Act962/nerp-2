"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { currencyFormatter } from "@/utils/currency-formatter";
import { AlertTriangle } from "lucide-react";
import type { EditorItem } from "../lib/editor-item";
import { buildPurchaseEntries } from "@/features/financeiro/lib/purchase-entries";

/**
 * A última tela antes do irreversível.
 *
 * Processar reescreve custo e preço de venda, e não existe histórico de preço
 * no sistema — depois daqui não dá para saber quanto era antes. Por isso o
 * de/para aparece item a item: é a única chance de revisão.
 */
export function ProcessPurchaseDialog({
  open,
  onOpenChange,
  items,
  total,
  installments,
  firstDueDate,
  purchaseNumber,
  invoiceNumber,
  isPending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: EditorItem[];
  total: number;
  installments: number;
  firstDueDate: string;
  purchaseNumber: number | null;
  invoiceNumber: string;
  isPending: boolean;
  onConfirm: () => void;
}) {
  const comEstoque = items.filter((item) => item.product.trackStock);
  const comPreco = items.filter((item) => item.newSalePrice !== null);

  const parcelas = buildPurchaseEntries({
    purchaseNumber: purchaseNumber ?? 0,
    invoiceNumber: invoiceNumber || null,
    total,
    installments,
    firstDueDate: firstDueDate ? new Date(firstDueDate) : null,
    receivedAt: new Date(),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Processar entrada</DialogTitle>
          <DialogDescription>
            Depois disso o estoque entra, o custo é reescrito e as contas a
            pagar são criadas. Não há como desfazer.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh] pr-3">
          <div className="flex flex-col gap-4 text-sm">
            <section>
              <h3 className="mb-1 font-medium">Estoque e custo</h3>
              <p className="text-muted-foreground">
                {comEstoque.length} de {items.length}{" "}
                {items.length === 1 ? "produto entra" : "produtos entram"} no
                estoque. O custo é atualizado em todos que vieram com valor.
              </p>
            </section>

            <section>
              <h3 className="mb-1 font-medium">
                Preço de venda ({comPreco.length}{" "}
                {comPreco.length === 1 ? "alteração" : "alterações"})
              </h3>
              {comPreco.length === 0 ? (
                <p className="text-muted-foreground">
                  Nenhum preço de venda será alterado.
                </p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {comPreco.map((item) => (
                    <li
                      key={item.lineId}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="truncate">{item.name}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {currencyFormatter(item.product.salePrice)} →{" "}
                        <strong className="text-foreground">
                          {currencyFormatter(item.newSalePrice ?? 0)}
                        </strong>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="mb-1 font-medium">
                Contas a pagar ({parcelas.length}
                {parcelas.length === 1 ? " parcela" : " parcelas"})
              </h3>
              <ul className="flex flex-col gap-1">
                {parcelas.map((parcela) => (
                  <li
                    key={parcela.purchaseEntryKey}
                    className="flex items-center justify-between gap-3 tabular-nums"
                  >
                    <span className="text-muted-foreground">
                      {parcela.dueDate.toLocaleDateString("pt-BR")}
                    </span>
                    <span>{currencyFormatter(parcela.amount / 100)}</span>
                  </li>
                ))}
              </ul>
            </section>

            <p className="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              Frete e desconto de cabeçalho entram no valor a pagar, mas não no
              custo dos produtos — sem rateio, eles são custo da nota, não da
              mercadoria.
            </p>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Voltar
          </Button>
          <Button type="button" onClick={onConfirm} disabled={isPending}>
            {isPending && <Spinner />}
            Processar entrada
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
