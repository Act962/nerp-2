"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useReceiptDefaultTemplate } from "@/features/receipt-designer/hooks/use-receipt-templates";
import { presetBlocks } from "@/features/receipt-designer/lib/presets";
import type {
  ReceiptBlock,
  ReceiptPaper,
  ReceiptSaleData,
} from "@/features/receipt-designer/lib/types";
import {
  ReceiptPrintArea,
  triggerReceiptPrint,
} from "@/features/receipt-designer/components/receipt-print";
import { CheckCircle, Printer, FileText, Receipt, Copy } from "lucide-react";

interface SaleCompletedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: {
    saleNumber: number;
    total: number;
    paymentMethod: string;
    change: number;
    customerName: string | null;
    invoiceGenerated: boolean;
  } | null;
  receiptData?: ReceiptSaleData | null;
  onNewSale: () => void;
  onPrintInvoice: () => void;
}

// Fallback quando a org ainda não tem template padrão de cupom.
const FALLBACK_BLOCKS: ReceiptBlock[] = presetBlocks("NAO_FISCAL");
const FALLBACK_PAPER: ReceiptPaper = "MM80";

export function SaleCompletedDialog({
  open,
  onOpenChange,
  sale,
  receiptData,
  onNewSale,
  onPrintInvoice,
}: SaleCompletedDialogProps) {
  const { data: defaultTemplate } = useReceiptDefaultTemplate();

  const template = defaultTemplate?.template ?? null;
  const printBlocks = template?.blocks ?? FALLBACK_BLOCKS;
  const printPaper = template?.paper ?? FALLBACK_PAPER;

  const handlePrintReceipt = () => {
    if (!receiptData) return;
    triggerReceiptPrint(printPaper);
  };

  if (!sale) return null;

  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  const paymentLabels: Record<string, string> = {
    DINHEIRO: "Dinheiro",
    CREDITO: "Cartão de Crédito",
    DEBITO: "Cartão de Débito",
    PIX: "PIX",
  };

  const handleNewSale = () => {
    onNewSale();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/20">
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
          </div>
          <DialogTitle className="text-xl">Venda Concluída!</DialogTitle>
          <DialogDescription>
            A venda foi registrada com sucesso
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Número da Venda
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold">
                  {sale.saleNumber}
                </span>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Cliente</span>
              <span className="text-sm">
                {sale.customerName || "Consumidor Final"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Pagamento</span>
              <span className="text-sm">
                {paymentLabels[sale.paymentMethod]}
              </span>
            </div>
            {sale.change > 0 && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Troco</span>
                <span className="text-sm text-success">
                  {formatCurrency(sale.change)}
                </span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between items-center">
              <span className="font-medium">Total</span>
              <span className="text-xl font-bold text-primary">
                {formatCurrency(sale.total)}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 bg-transparent"
              onClick={handlePrintReceipt}
              disabled={!receiptData}
            >
              <Receipt className="h-4 w-4 mr-2" />
              Cupom
            </Button>
            {sale.invoiceGenerated && (
              <Button
                variant="outline"
                className="flex-1 bg-transparent"
                onClick={onPrintInvoice}
              >
                <FileText className="h-4 w-4 mr-2" />
                NF-e
              </Button>
            )}
            <Button
              variant="outline"
              className="flex-1 bg-transparent"
              onClick={handlePrintReceipt}
              disabled={!receiptData}
            >
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
          </div>
        </div>

        {receiptData && (
          <ReceiptPrintArea
            blocks={printBlocks}
            data={receiptData}
            paper={printPaper}
          />
        )}

        <DialogFooter>
          <Button className="w-full" size="lg" onClick={handleNewSale}>
            Iniciar Nova Venda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
