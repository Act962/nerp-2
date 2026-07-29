"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatWidgetValue, type WidgetValue } from "../../lib/widget-value";

// Consulta do Oracle costuma render várias colunas (cliente, pedidos, receita,
// margem) — espremer isso num número único perderia o dado. Rolagem nos dois
// eixos dentro do card, com cabeçalho fixo para a tabela continuar legível.
export function TableWidget({
  value,
}: {
  value: Extract<WidgetValue, { kind: "TABLE" }>;
}) {
  if (value.rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Nenhum resultado para esta consulta.
      </p>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <Table className="text-xs">
        <TableHeader className="sticky top-0 z-10 bg-background">
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
          {value.rows.map((row) => (
            <TableRow key={row.id}>
              {row.cells.map((cell, index) => {
                const column = value.columns[index];
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
  );
}
