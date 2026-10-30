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
import Link from "next/link";
import { StatusNfce } from "@/features/fiscal/components/status-nfce";
import { useNfceDaVenda } from "@/features/fiscal/hooks/use-nfce";
import { useEffect, useMemo, useRef } from "react";
import { CheckCircle, Printer, Receipt, Copy } from "lucide-react";

interface SaleCompletedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: {
    saleNumber: number;
    total: number;
    paymentMethod: string;
    change: number;
    customerName: string | null;
    saleId?: string | null;
    // A venda pediu NFC-e: a tela acompanha a autorização e o cupom vira DANFCe.
    nfceSolicitada?: boolean;
    // A emissão foi recusada antes de criar o documento.
    nfceErro?: string | null;
  } | null;
  receiptData?: ReceiptSaleData | null;
  // Espelha o checkbox "Imprimir Cupom" do pagamento: dispara a impressão
  // sozinho ao abrir, sem o operador ter que clicar de novo.
  autoPrint?: boolean;
  onNewSale: () => void;
}

// Fallback quando a org ainda não tem template padrão de cupom.
const FALLBACK_BLOCKS: ReceiptBlock[] = presetBlocks("NAO_FISCAL");
const FALLBACK_PAPER: ReceiptPaper = "MM80";
const FISCAL_BLOCKS: ReceiptBlock[] = presetBlocks("FISCAL");

export function SaleCompletedDialog({
  open,
  onOpenChange,
  sale,
  receiptData,
  autoPrint = false,
  onNewSale,
}: SaleCompletedDialogProps) {
  const { data: defaultTemplate, isPending: templatePending } =
    useReceiptDefaultTemplate();

  const nfceSolicitada = !!sale?.nfceSolicitada && !!sale.saleId;
  const nfceQuery = useNfceDaVenda(
    nfceSolicitada ? (sale?.saleId ?? null) : null,
  );
  const documento = nfceQuery.data;
  const autorizada =
    documento?.status === "AUTHORIZED" && documento.chave && documento.qrCodeUrl
      ? documento
      : null;
  // Sem nota válida (rejeitada, denegada, cancelada no balcão) não imprime
  // sozinho: o cupom sem nota precisa ser uma decisão do caixa, não um efeito
  // colateral.
  const nfceFalhou =
    documento?.status === "REJECTED" ||
    documento?.status === "DENIED" ||
    documento?.status === "CANCELLED" ||
    documento?.status === "VOIDED";
  const aguardandoNfce = nfceSolicitada && !autorizada && !nfceFalhou;

  const template = defaultTemplate?.template ?? null;
  // DANFCe sai no layout fiscal mesmo que o padrão da loja seja o recibo.
  const printBlocks =
    autorizada && template?.type !== "FISCAL"
      ? FISCAL_BLOCKS
      : (template?.blocks ?? FALLBACK_BLOCKS);
  const printPaper = template?.paper ?? FALLBACK_PAPER;

  // Memorizado: um objeto novo a cada render reiniciaria o efeito de
  // impressão automática e cancelaria o timer antes de imprimir.
  const dadosCupom = useMemo<ReceiptSaleData | null | undefined>(
    () =>
      receiptData && autorizada?.chave && autorizada.qrCodeUrl
        ? {
            ...receiptData,
            nfceUrl: autorizada.qrCodeUrl,
            nfce: {
              chave: autorizada.chave,
              protocolo: autorizada.protocolo ?? "",
              numero: autorizada.numero,
              serie: autorizada.serie,
              autorizadoEm: autorizada.autorizadoEm ?? new Date().toISOString(),
              homologacao: autorizada.ambiente === "HOMOLOGACAO",
              qrCodeUrl: autorizada.qrCodeUrl,
              consultaUrl: autorizada.consultaUrl,
              consumidor: autorizada.destinatario,
            },
          }
        : receiptData,
    [receiptData, autorizada],
  );

  const handlePrintReceipt = () => {
    if (!dadosCupom) return;
    triggerReceiptPrint(printPaper);
  };

  // Só imprime depois que o template padrão da org resolveu — senão sairia no
  // preset de fallback — e depois que o portal do cupom montou, porque o @page
  // é calculado a partir da altura já renderizada. Uma vez por venda: o ref
  // guarda o número impresso para o efeito não repetir a cada render.
  const printedSaleRef = useRef<number | null>(null);
  const saleNumber = sale?.saleNumber ?? null;
  useEffect(() => {
    if (!open || !autoPrint || !dadosCupom || templatePending) return;
    // Com NFC-e pedida, só imprime o DANFCe — depois de autorizado.
    if (aguardandoNfce || (nfceSolicitada && nfceFalhou)) return;
    if (saleNumber === null || printedSaleRef.current === saleNumber) return;
    printedSaleRef.current = saleNumber;
    const timer = setTimeout(() => triggerReceiptPrint(printPaper), 250);
    return () => clearTimeout(timer);
  }, [
    open,
    autoPrint,
    dadosCupom,
    templatePending,
    aguardandoNfce,
    nfceSolicitada,
    nfceFalhou,
    saleNumber,
    printPaper,
  ]);

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

          {sale.nfceErro && (
            <div
              role="alert"
              className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm"
            >
              <span>A NFC-e não foi emitida. {sale.nfceErro}</span>
              <Button size="sm" variant="outline" asChild>
                <Link href="/produtos/fiscal">Corrigir cadastro fiscal</Link>
              </Button>
            </div>
          )}

          {nfceSolicitada && (
            <StatusNfce
              documento={documento}
              carregando={nfceQuery.isPending}
            />
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 bg-transparent"
              onClick={handlePrintReceipt}
              disabled={!dadosCupom || aguardandoNfce}
            >
              <Receipt className="h-4 w-4 mr-2" />
              {autorizada ? "DANFCe" : "Cupom"}
            </Button>
            <Button
              variant="outline"
              className="flex-1 bg-transparent"
              onClick={handlePrintReceipt}
              disabled={!dadosCupom || aguardandoNfce}
            >
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
          </div>
        </div>

        {dadosCupom && (
          <ReceiptPrintArea
            blocks={printBlocks}
            data={dadosCupom}
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
