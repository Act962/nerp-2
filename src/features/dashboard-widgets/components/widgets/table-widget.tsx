"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatWidgetValue, type WidgetValue } from "../../lib/widget-value";
import { pastelHex } from "../../lib/pastel-colors";
import { evaluateCellValue, type WidgetAlert } from "../../lib/widget-alert";

const DEFAULT_PAGE_SIZE = 10;

export function TableWidget({
  value,
  alerts,
  targetValue,
  pageSize = DEFAULT_PAGE_SIZE,
}: {
  value: Extract<WidgetValue, { kind: "TABLE" }>;
  alerts?: WidgetAlert[];
  targetValue?: number | null;
  pageSize?: number;
}) {
  const [page, setPage] = useState(0);

  if (value.rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Nenhum resultado para esta consulta.
      </p>
    );
  }

  const totalRows = value.rows.length;
  const totalPages = Math.ceil(totalRows / pageSize);
  const hasPagination = totalPages > 1;
  const start = page * pageSize;
  const pageRows = value.rows.slice(start, start + pageSize);

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              {value.columns.map((column) => (
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
            {pageRows.map((row) => (
              <TableRow key={row.id}>
                {row.cells.map((cell, index) => {
                  const column = value.columns[index];
                  const alertColor =
                    alerts && alerts.length > 0 && typeof cell === "number"
                      ? evaluateCellValue(
                          alerts,
                          cell,
                          targetValue ?? null,
                          column?.key ?? null,
                        )
                      : null;
                  const hex = alertColor ? pastelHex(alertColor) : null;
                  return (
                    <TableCell
                      key={column?.key ?? index}
                      className={cn(
                        "py-1.5",
                        column?.align === "right" &&
                          "text-right tabular-nums whitespace-nowrap",
                      )}
                      style={hex ? { color: hex } : undefined}
                    >
                      {typeof cell === "number" ? (
                        <>
                          {formatWidgetValue(cell, column?.unit)}
                          {hex && (
                            <AlertTriangle
                              className="ml-1 inline-block size-3"
                              style={{ color: hex }}
                            />
                          )}
                        </>
                      ) : (
                        (cell ?? "—")
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {hasPagination && (
        <div className="flex shrink-0 items-center justify-between border-t px-1 py-1">
          <button
            type="button"
            disabled={page === 0}
            onClick={(e) => {
              e.stopPropagation();
              setPage((p) => Math.max(0, p - 1));
            }}
            className="flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {start + 1}–{Math.min(start + pageSize, totalRows)} de {totalRows}
          </span>
          <button
            type="button"
            disabled={page >= totalPages - 1}
            onClick={(e) => {
              e.stopPropagation();
              setPage((p) => Math.min(totalPages - 1, p + 1));
            }}
            className="flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
