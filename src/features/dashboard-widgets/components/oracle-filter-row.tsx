"use client";

import { useState } from "react";
import { Plus, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useOracleDimensionValues } from "../hooks/use-oracle-explorer";
import {
  FILTER_OPERATORS,
  OPERATOR_LABEL,
  type OracleFilterOperator,
  type OracleQueryFilter,
} from "../lib/oracle-query-config";
import { OracleTermOption } from "./oracle-term-option";

interface ColumnOption {
  name: string;
  label: string;
  description: string;
  role: string;
  indexed: boolean;
  leadingIndex: boolean;
}

interface QuickFilterOption {
  key: string;
  label: string;
  column: string;
}

/** Operadores que não pedem valor nenhum. */
const NO_VALUE: OracleFilterOperator[] = ["isNull", "notNull"];

/**
 * Atalhos curados: "Filial = Matriz" em vez de "CODFILIAL eq 1". Todos caem em
 * colunas confirmadamente indexadas, então são também o caminho rápido.
 */
export function OracleQuickFilterChips({
  quickFilters,
  filters,
  onChange,
}: {
  quickFilters: QuickFilterOption[];
  filters: OracleQueryFilter[];
  onChange: (filters: OracleQueryFilter[]) => void;
}) {
  const [active, setActive] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const { data, isLoading } = useOracleDimensionValues(active, search);

  if (quickFilters.length === 0) return null;

  const selected = quickFilters.find((filter) => filter.key === active);

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[10px] text-muted-foreground">
        Filtros rápidos
      </Label>
      <div className="flex flex-wrap items-center gap-1">
        {quickFilters.map((quickFilter) => {
          const applied = filters.find(
            (filter) => filter.column === quickFilter.column,
          );
          return (
            <Button
              key={quickFilter.key}
              type="button"
              size="sm"
              variant={applied ? "default" : "outline"}
              className="h-6 gap-1 px-2 text-[10px]"
              onClick={() => {
                setSearch("");
                setActive(active === quickFilter.key ? null : quickFilter.key);
              }}
            >
              <Zap className="size-2.5" />
              {quickFilter.label}
              {applied && (
                <span className="opacity-80">
                  : {String(applied.values[0]).slice(0, 12)}
                </span>
              )}
            </Button>
          );
        })}
      </div>

      {selected && (
        <div className="flex flex-col gap-1 rounded-md border p-2">
          <Input
            className="h-7 text-xs"
            placeholder={`Buscar ${selected.label.toLowerCase()}…`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="max-h-40 overflow-y-auto">
            {isLoading && (
              <p className="p-1 text-[10px] text-muted-foreground">
                Carregando…
              </p>
            )}
            {(data?.values ?? []).map((option) => (
              <button
                key={option.value}
                type="button"
                className="block w-full truncate rounded px-1.5 py-1 text-left text-[11px] hover:bg-muted"
                onClick={() => {
                  const others = filters.filter(
                    (filter) => filter.column !== selected.column,
                  );
                  onChange([
                    ...others,
                    {
                      column: selected.column,
                      operator: "eq",
                      values: [option.value],
                    },
                  ]);
                  setActive(null);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
          {filters.some((filter) => filter.column === selected.column) && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 text-[10px] text-muted-foreground"
              onClick={() => {
                onChange(
                  filters.filter((filter) => filter.column !== selected.column),
                );
                setActive(null);
              }}
            >
              Limpar filtro
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Filtro avançado: qualquer coluna, qualquer operador. A marcação de índice
 * (⚡ / ⚠) é o que evita o usuário montar sem saber uma consulta que varre a
 * tabela inteira.
 */
export function OracleFilterRow({
  columns,
  filters,
  onChange,
}: {
  columns: ColumnOption[];
  filters: OracleQueryFilter[];
  onChange: (filters: OracleQueryFilter[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const advanced = filters.filter((filter) => filter.operator !== "eq");

  const update = (index: number, next: Partial<OracleQueryFilter>) => {
    const copy = [...filters];
    copy[index] = { ...copy[index], ...next };
    onChange(copy);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {filters.map((filter, index) => {
        const column = columns.find((item) => item.name === filter.column);
        // Chips curados já aparecem acima; aqui só o que foi montado à mão.
        if (filter.operator === "eq" && !open && advanced.length === 0) {
          return null;
        }
        return (
          <div key={index} className="flex flex-wrap items-center gap-1.5">
            <Select
              value={filter.column}
              onValueChange={(value) => update(index, { column: value })}
            >
              <SelectTrigger className="h-7 w-40 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {columns.slice(0, 100).map((item) => (
                  <SelectItem key={item.name} value={item.name}>
                    <OracleTermOption
                      code={item.name}
                      label={item.label}
                      description={item.description}
                      leadingIndex={item.leadingIndex}
                      indexed={item.indexed}
                    />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filter.operator}
              onValueChange={(value) =>
                update(index, {
                  operator: value as OracleFilterOperator,
                  values: NO_VALUE.includes(value as OracleFilterOperator)
                    ? []
                    : filter.values.slice(0, 1),
                })
              }
            >
              <SelectTrigger className="h-7 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILTER_OPERATORS.map((operator) => (
                  <SelectItem key={operator} value={operator}>
                    {OPERATOR_LABEL[operator]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {!NO_VALUE.includes(filter.operator) && (
              <Input
                className="h-7 w-32 text-xs"
                placeholder={
                  filter.operator === "in"
                    ? "valores separados por vírgula"
                    : "valor"
                }
                value={filter.values.join(", ")}
                onChange={(event) =>
                  update(index, {
                    values:
                      filter.operator === "in" || filter.operator === "between"
                        ? event.target.value
                            .split(",")
                            .map((part) => part.trim())
                            .filter(Boolean)
                        : [event.target.value],
                  })
                }
              />
            )}

            {column && !column.indexed && (
              <span className="text-[10px] text-amber-600 dark:text-amber-400">
                sem índice
              </span>
            )}

            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              onClick={() =>
                onChange(filters.filter((_, position) => position !== index))
              }
            >
              <X className="size-3" />
            </Button>
          </div>
        );
      })}

      {filters.length < 8 && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className={cn("h-6 w-fit gap-1 px-1.5 text-[10px]")}
          onClick={() => {
            setOpen(true);
            onChange([
              ...filters,
              {
                column: columns[0]?.name ?? "",
                operator: "eq",
                values: [""],
              },
            ]);
          }}
        >
          <Plus className="size-3" /> filtro avançado
        </Button>
      )}
    </div>
  );
}
