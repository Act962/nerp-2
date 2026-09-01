"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { currencyFormatter } from "@/utils/currency-formatter";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { usePurchases } from "../hooks/use-purchases";

const STATUS: Record<
  "PENDING" | "CONFIRMED" | "RECEIVED" | "CANCELLED",
  { label: string; variant: "secondary" | "default" | "outline" }
> = {
  PENDING: { label: "Rascunho", variant: "secondary" },
  CONFIRMED: { label: "Conferida", variant: "secondary" },
  RECEIVED: { label: "Processada", variant: "default" },
  CANCELLED: { label: "Cancelada", variant: "outline" },
};

export function PurchasesList() {
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const search = useDebouncedValue(term, 300);
  const { data, isLoading } = usePurchases({ search, page });

  const purchases = data?.purchases ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por nº da nota ou nº da entrada..."
          value={term}
          onChange={(event) => {
            setTerm(event.target.value);
            setPage(1);
          }}
          className="max-w-sm"
        />
        <Button asChild className="ml-auto">
          <Link href="/estoque/entradas/nova">
            <Plus className="size-4" />
            Nova entrada
          </Link>
        </Button>
      </div>

      <Table stacked>
        <TableHeader>
          <TableRow>
            <TableHead>Entrada</TableHead>
            <TableHead>Nº da NF</TableHead>
            <TableHead>Fornecedor</TableHead>
            <TableHead>Itens</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Situação</TableHead>
            <TableHead>Data</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={7} className="text-muted-foreground">
                Carregando...
              </TableCell>
            </TableRow>
          )}
          {!isLoading && purchases.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-muted-foreground">
                Nenhuma entrada de nota ainda.
              </TableCell>
            </TableRow>
          )}
          {purchases.map((purchase) => (
            <TableRow key={purchase.id}>
              <TableCell data-label="Entrada">
                <Link
                  href={`/estoque/entradas/${purchase.id}`}
                  className="font-medium hover:underline"
                >
                  #{purchase.purchaseNumber}
                </Link>
              </TableCell>
              <TableCell data-label="Nº da NF">
                {purchase.invoiceNumber ?? "—"}
              </TableCell>
              <TableCell data-label="Fornecedor">
                {purchase.supplierName ?? "—"}
              </TableCell>
              <TableCell data-label="Itens" className="tabular-nums">
                {purchase.itemCount}
              </TableCell>
              <TableCell data-label="Total" className="tabular-nums">
                {currencyFormatter(purchase.total)}
                {purchase.installments > 1 && (
                  <span className="text-xs text-muted-foreground">
                    {" "}
                    em {purchase.installments}x
                  </span>
                )}
              </TableCell>
              <TableCell data-label="Situação">
                <Badge variant={STATUS[purchase.status].variant}>
                  {STATUS[purchase.status].label}
                </Badge>
              </TableCell>
              <TableCell data-label="Data" className="tabular-nums">
                {new Date(
                  purchase.receivedDate ?? purchase.orderDate,
                ).toLocaleDateString("pt-BR")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {(data?.totalPages ?? 1) > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((atual) => atual - 1)}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} de {data?.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= (data?.totalPages ?? 1)}
            onClick={() => setPage((atual) => atual + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}
