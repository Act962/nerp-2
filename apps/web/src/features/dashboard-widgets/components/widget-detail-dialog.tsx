"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useOracleDrilldown } from "../hooks/use-dashboard-widgets";
import { formatWidgetValue, type WidgetValue } from "../lib/widget-value";
import { type DetailTable, widgetValueToTable } from "../lib/widget-value-rows";

/** Padrão pedido: 20 itens por página, com o usuário podendo trocar. */
const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export function WidgetDetailDialog({
  title,
  value,
  computedAt,
  widgetId,
  supportsDrilldown,
  onOpenChange,
}: {
  title: string;
  value: WidgetValue | null;
  computedAt?: string | null;
  widgetId: string;
  /** Só consulta ao Oracle sabe listar os registros que geraram o número. */
  supportsDrilldown: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(0);
  // Num card de número único o resumo não diz nada (1 linha), então já abre
  // nos registros; nos outros o resumo é o que a pessoa foi ver.
  const [tab, setTab] = useState<"summary" | "records">(
    supportsDrilldown && value?.kind === "STAT" ? "records" : "summary",
  );

  const showRecords = supportsDrilldown && tab === "records";
  const drilldown = useOracleDrilldown(
    showRecords ? widgetId : null,
    page,
    pageSize,
  );

  const summary = useMemo(
    () => (value ? widgetValueToTable(value) : null),
    [value],
  );

  // Registro cru do ERP não tem unidade declarada (VLTOTAL é número, não
  // "moeda" segundo o dicionário), então sai sem formatação monetária — é o
  // valor exatamente como está no banco.
  const table: DetailTable | null = showRecords
    ? drilldown.data?.ok
      ? {
          columns: drilldown.data.columns.map((column) => ({
            ...column,
            unit: undefined,
          })),
          rows: drilldown.data.rows,
        }
      : null
    : summary;
  // No resumo a paginação é sobre o array em memória; nos registros o total
  // vem do banco (é o 1.490 do card), então a página é servida pelo servidor.
  const total = showRecords
    ? (drilldown.data?.total ?? 0)
    : (summary?.rows.length ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  // Trocar o tamanho da página pode deixar a página atual fora do intervalo.
  useEffect(() => {
    setPage((current) => Math.min(current, pageCount - 1));
  }, [pageCount]);

  const visible = !table
    ? []
    : showRecords
      ? table.rows
      : table.rows.slice(page * pageSize, page * pageSize + pageSize);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {total} {total === 1 ? "registro" : "registros"}
            {computedAt &&
              !showRecords &&
              ` · atualizado em ${new Date(computedAt).toLocaleString("pt-BR")}`}
          </DialogDescription>
        </DialogHeader>

        {supportsDrilldown && (
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              variant={tab === "summary" ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => {
                setTab("summary");
                setPage(0);
              }}
            >
              Resumo
            </Button>
            <Button
              type="button"
              size="sm"
              variant={tab === "records" ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => {
                setTab("records");
                setPage(0);
              }}
            >
              Registros
            </Button>
          </div>
        )}

        {showRecords && drilldown.isLoading && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Buscando registros no ERP…
          </p>
        )}
        {showRecords && drilldown.data && !drilldown.data.ok && (
          <p className="py-8 text-center text-sm text-destructive">
            {drilldown.data.message}
          </p>
        )}

        {showRecords && drilldown.isLoading ? null : !table || total === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum dado para exibir.
          </p>
        ) : (
          <>
            <div className="max-h-[55vh] overflow-auto rounded-md border">
              <Table className="text-xs">
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    {table.columns.map((column) => (
                      <TableHead
                        key={column.key}
                        className={cn(
                          "h-8 whitespace-nowrap",
                          column.align === "right" && "text-right",
                        )}
                      >
                        {column.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((row) => (
                    <TableRow key={row.id}>
                      {row.cells.map((cell, index) => {
                        const column = table.columns[index];
                        return (
                          <TableCell
                            key={column?.key ?? index}
                            className={cn(
                              "py-1.5",
                              column?.align === "right" &&
                                "text-right tabular-nums whitespace-nowrap",
                            )}
                          >
                            {typeof cell === "number"
                              ? formatWidgetValue(cell, column?.unit)
                              : (cell ?? "—")}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">
                  Itens por página
                </span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(next) => {
                    setPageSize(Number(next));
                    setPage(0);
                  }}
                >
                  <SelectTrigger className="h-7 w-20 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={String(option)}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">
                  {page * pageSize + 1}–{Math.min(total, (page + 1) * pageSize)}{" "}
                  de {total}
                </span>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  disabled={page === 0}
                  onClick={() => setPage((current) => current - 1)}
                >
                  <ChevronLeft className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  disabled={page >= pageCount - 1}
                  onClick={() => setPage((current) => current + 1)}
                >
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
