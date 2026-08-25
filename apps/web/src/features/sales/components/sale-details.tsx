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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, Download, Printer, Mail } from "lucide-react";
import { statusConfig } from "@/utils/status-sales-config";
import { format } from "date-fns";
import { currencyFormatter } from "@/utils/currency-formatter";
import { useQuerySale } from "../hooks/use-sales";
import { useParams } from "next/navigation";

interface SaleDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleId: string;
}

export function SaleDetailsDialog({
  open,
  onOpenChange,
  saleId,
}: SaleDetailsDialogProps) {
  const { data: sale, isLoadingSale } = useQuerySale({ saleId });

  if (!sale || isLoadingSale) return null;

  const status = statusConfig[sale.status];
  const StatusIcon = status.icon;

  const formatDate = (date: Date) => format(date, "dd/MM/yyyy HH:mm");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Detalhes da Venda
              </DialogTitle>
              <DialogDescription>Número {sale.saleNumber}</DialogDescription>
            </div>
            <Badge className={`${status.className} mt-4`}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {status.label}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Info Grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Informações da Nota</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Venda</span>
                  <span className="font-mono">{sale.saleNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Data</span>
                  <span className="font-mono">
                    {formatDate(sale.createdAt)}
                  </span>
                </div>
                {sale.authorizedAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Autorização</span>
                    <span>{formatDate(sale.authorizedAt)}</span>
                  </div>
                )}
                {sale.cancelledAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cancelamento</span>
                    <span>{formatDate(sale.cancelledAt)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold">
                {sale.customer ? "Destinatário" : "Consumidor Final"}
              </h4>
              {sale.customer ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nome</span>
                    <span className="text-right">{sale.customer.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">CPF/CNPJ</span>
                    <span className="font-mono">{sale.customer.document}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cidade/UF</span>
                    <span>
                      {sale.customer.city}/{sale.customer.state}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Venda para consumidor final não identificado
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Items */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Itens da Nota</h4>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-center">Qtd</TableHead>
                    <TableHead className="text-right">Unitário</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sale.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <span className="font-medium">
                            {item.productName}
                          </span>
                          <br />
                          <span className="text-xs text-muted-foreground">
                            {item.sku}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {item.categoryName}
                      </TableCell>
                      <TableCell className="text-center">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right">
                        {currencyFormatter(item.unitPrice)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {currencyFormatter(item.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Totals */}
          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{currencyFormatter(sale.subtotal)}</span>
            </div>
            {sale.discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Desconto</span>
                <span className="text-success">
                  - {currencyFormatter(sale.discount)}
                </span>
              </div>
            )}
            {/* <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">ICMS</span>
              <span>{currencyFormatter(sale.icms)}</span>
            </div> */}
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Total da Nota</span>
              <span className="text-lg text-primary">
                {currencyFormatter(sale.total)}
              </span>
            </div>
          </div>

          {/* Cancellation Reason */}
          {sale.status === "CANCELLED" && sale.cancellationReason && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
              <h4 className="text-sm font-semibold text-destructive mb-1">
                Motivo do Cancelamento
              </h4>
              <p className="text-sm">{sale.cancellationReason}</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex gap-2 flex-1">
            {sale.xmlUrl && (
              <Button
                variant="outline"
                className="flex-1 bg-transparent"
                asChild
              >
                <a href={sale.xmlUrl} download>
                  <Download className="h-4 w-4 mr-2" />
                  XML
                </a>
              </Button>
            )}
            {sale.pdfUrl && (
              <Button
                variant="outline"
                className="flex-1 bg-transparent"
                asChild
              >
                <a href={sale.pdfUrl} download>
                  <Download className="h-4 w-4 mr-2" />
                  PDF (DANFE)
                </a>
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="bg-transparent">
              <Mail className="h-4 w-4 mr-2" />
              Enviar por E-mail
            </Button>
            <Button variant="outline" className="bg-transparent">
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
