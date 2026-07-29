"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Plus, X, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import {
  useOracleColumns,
  useOracleTables,
  usePreviewOracleQuery,
} from "../hooks/use-oracle-explorer";
import {
  AGGREGATION_LABEL,
  AGGREGATIONS,
  DATE_PRESET_LABEL,
  DATE_PRESETS,
  type OracleAggregation,
  type OracleDatePreset,
  type OracleQueryConfig,
} from "../lib/oracle-query-config";
import { OracleFilterRow, OracleQuickFilterChips } from "./oracle-filter-row";
import { OracleTemplatePicker } from "./oracle-template-picker";
import { OracleTermOption } from "./oracle-term-option";

export type OracleDraft = OracleQueryConfig;

export const EMPTY_ORACLE_DRAFT: OracleDraft = {
  version: 1,
  table: "",
  measures: [
    { aggregation: "SUM", column: null, label: "Total", unit: "number" },
  ],
  groupBy: { kind: "none" },
  dateFilter: null,
  filters: [],
  salesFilter: null,
  orderBy: "measureDesc",
  limit: 20,
};

const SALES_FILTER_OPTIONS = [
  {
    value: "valid",
    label: "Pedidos válidos",
    hint: "Mesma regra do ranking — os números batem.",
  },
  {
    value: "invoiced",
    label: "Somente faturado",
    hint: "Só nota emitida. Receita mais conservadora.",
  },
  {
    value: "none",
    label: "Sem filtro",
    hint: "Inclui cancelado e bonificação — diverge do ranking.",
  },
] as const;

export function OracleQueryBuilder({
  draft,
  displayType,
  onChange,
  onApplyTemplate,
}: {
  draft: OracleDraft;
  displayType: string;
  onChange: (next: OracleDraft) => void;
  /** Modelo traz consulta + tipo de exibição + nome sugerido de uma vez. */
  onApplyTemplate: (payload: {
    config: OracleDraft;
    displayType: "STAT" | "CHART" | "LIST" | "TABLE";
    name: string;
  }) => void;
}) {
  const { data: tablesData, isLoading: loadingTables } = useOracleTables(true);
  const { data: columnsData } = useOracleColumns(draft.table || null);
  const preview = usePreviewOracleQuery();
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
    warnings: string[];
  } | null>(null);

  const columns = columnsData?.columns ?? [];
  const measureColumns = columns.filter((column) => column.role === "measure");
  const dimensionColumns = columns.filter(
    (column) => column.role === "dimension",
  );
  const dateColumns = columns.filter((column) => column.role === "date");
  const isLargeTable = (columnsData?.rowCount ?? 0) > 1_000_000;

  const patch = (next: Partial<OracleDraft>) => {
    setResult(null);
    onChange({ ...draft, ...next });
  };

  // Trocar de tabela invalida coluna/filtro escolhidos na anterior.
  const changeTable = (table: string) => {
    setResult(null);
    onChange({
      ...EMPTY_ORACLE_DRAFT,
      table,
      salesFilter: null,
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-md border bg-muted/20 p-3">
      <OracleTemplatePicker
        availableTables={(tablesData?.tables ?? []).map((table) => table.name)}
        currentConfig={draft}
        currentDisplayType={displayType}
        onApply={(payload) => {
          setResult(null);
          onApplyTemplate(payload);
        }}
      />

      <div className="flex flex-col gap-1.5">
        <Label className="text-[10px] text-muted-foreground">
          Tabela do ERP
        </Label>
        <Select value={draft.table} onValueChange={changeTable}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue
              placeholder={loadingTables ? "Carregando…" : "Escolha uma tabela"}
            />
          </SelectTrigger>
          <SelectContent>
            {(tablesData?.tables ?? []).map((table) => (
              <SelectItem key={table.name} value={table.name}>
                <OracleTermOption
                  code={table.name}
                  label={
                    table.rowCount !== null
                      ? `${table.label} (${table.rowCount.toLocaleString("pt-BR")})`
                      : table.label
                  }
                  description={table.description}
                />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {draft.table && (
        <>
          {/* --- Medidas --- */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground">
                O que calcular
              </Label>
              {draft.measures.length < 6 && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 gap-1 px-1.5 text-[10px]"
                  onClick={() =>
                    patch({
                      measures: [
                        ...draft.measures,
                        {
                          aggregation: "SUM",
                          column: measureColumns[0]?.name ?? null,
                          label: `Medida ${draft.measures.length + 1}`,
                          unit: "number",
                        },
                      ],
                    })
                  }
                >
                  <Plus className="size-3" /> medida
                </Button>
              )}
            </div>
            {draft.measures.map((measure, index) => (
              <div key={index} className="flex flex-wrap items-center gap-1.5">
                <Select
                  value={measure.aggregation}
                  onValueChange={(value) => {
                    const measures = [...draft.measures];
                    measures[index] = {
                      ...measure,
                      aggregation: value as OracleAggregation,
                      column:
                        value === "COUNT" ? null : (measure.column ?? null),
                    };
                    patch({ measures });
                  }}
                >
                  <SelectTrigger className="h-7 w-32 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGGREGATIONS.filter(
                      (aggregation) =>
                        !(aggregation === "COUNT_DISTINCT" && isLargeTable),
                    ).map((aggregation) => (
                      <SelectItem key={aggregation} value={aggregation}>
                        {AGGREGATION_LABEL[aggregation]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {measure.aggregation !== "COUNT" && (
                  <Select
                    value={measure.column ?? ""}
                    onValueChange={(value) => {
                      const measures = [...draft.measures];
                      measures[index] = { ...measure, column: value };
                      patch({ measures });
                    }}
                  >
                    <SelectTrigger className="h-7 w-36 text-xs">
                      <SelectValue placeholder="coluna" />
                    </SelectTrigger>
                    <SelectContent>
                      {(measureColumns.length > 0
                        ? measureColumns
                        : columns
                      ).map((column) => (
                        <SelectItem key={column.name} value={column.name}>
                          <OracleTermOption
                            code={column.name}
                            label={column.label}
                            description={column.description}
                          />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Input
                  className="h-7 w-28 text-xs"
                  placeholder="rótulo"
                  value={measure.label}
                  onChange={(event) => {
                    const measures = [...draft.measures];
                    measures[index] = { ...measure, label: event.target.value };
                    patch({ measures });
                  }}
                />

                <Select
                  value={measure.unit}
                  onValueChange={(value) => {
                    const measures = [...draft.measures];
                    measures[index] = {
                      ...measure,
                      unit: value as "currency" | "number" | "percent",
                    };
                    patch({ measures });
                  }}
                >
                  <SelectTrigger className="h-7 w-24 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="number">Número</SelectItem>
                    <SelectItem value="currency">R$</SelectItem>
                    <SelectItem value="percent">%</SelectItem>
                  </SelectContent>
                </Select>

                {draft.measures.length > 1 && (
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      patch({
                        measures: draft.measures.filter(
                          (_, position) => position !== index,
                        ),
                      })
                    }
                  >
                    <X className="size-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* --- Agrupamento --- */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Label className="text-[10px] text-muted-foreground">
              Agrupar por
            </Label>
            <Select
              value={
                draft.groupBy.kind === "none"
                  ? "none"
                  : `${draft.groupBy.kind}:${draft.groupBy.column}`
              }
              onValueChange={(value) => {
                if (value === "none") {
                  patch({ groupBy: { kind: "none" } });
                  return;
                }
                const [kind, column] = value.split(":");
                patch({
                  groupBy:
                    kind === "date"
                      ? { kind: "date", column, granularity: "month" }
                      : { kind: "dimension", column },
                });
              }}
            >
              <SelectTrigger className="h-7 w-44 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nada (valor único)</SelectItem>
                {dateColumns.map((column) => (
                  <SelectItem key={column.name} value={`date:${column.name}`}>
                    <OracleTermOption
                      code={column.name}
                      label={`Por data: ${column.label}`}
                      description={column.description}
                    />
                  </SelectItem>
                ))}
                {dimensionColumns.slice(0, 60).map((column) => (
                  <SelectItem
                    key={column.name}
                    value={`dimension:${column.name}`}
                  >
                    <OracleTermOption
                      code={column.name}
                      label={column.label}
                      description={column.description}
                    />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {draft.groupBy.kind === "date" && (
              <Select
                value={draft.groupBy.granularity}
                onValueChange={(value) =>
                  patch({
                    groupBy: {
                      kind: "date",
                      column: (draft.groupBy as { column: string }).column,
                      granularity: value as "day" | "month",
                    },
                  })
                }
              >
                <SelectTrigger className="h-7 w-24 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Por dia</SelectItem>
                  <SelectItem value="month">Por mês</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {/* --- Período --- */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Label className="text-[10px] text-muted-foreground">Período</Label>
            <Select
              value={draft.dateFilter?.column ?? ""}
              onValueChange={(value) =>
                patch({
                  dateFilter: {
                    column: value,
                    preset: draft.dateFilter?.preset ?? "last30",
                  },
                })
              }
            >
              <SelectTrigger className="h-7 w-40 text-xs">
                <SelectValue placeholder="coluna de data" />
              </SelectTrigger>
              <SelectContent>
                {dateColumns.map((column) => (
                  <SelectItem key={column.name} value={column.name}>
                    <OracleTermOption
                      code={column.name}
                      label={column.label}
                      description={column.description}
                      leadingIndex={column.leadingIndex}
                    />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {draft.dateFilter && (
              <Select
                value={draft.dateFilter.preset}
                onValueChange={(value) =>
                  patch({
                    dateFilter: {
                      column: draft.dateFilter?.column ?? "",
                      preset: value as OracleDatePreset,
                    },
                  })
                }
              >
                <SelectTrigger className="h-7 w-36 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_PRESETS.map((preset) => (
                    <SelectItem key={preset} value={preset}>
                      {DATE_PRESET_LABEL[preset]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {isLargeTable && !draft.dateFilter && (
              <span className="text-[10px] text-amber-600 dark:text-amber-400">
                Obrigatório nesta tabela.
              </span>
            )}
          </div>

          {/* --- Filtros --- */}
          <OracleQuickFilterChips
            quickFilters={columnsData?.quickFilters ?? []}
            filters={draft.filters}
            onChange={(filters) => patch({ filters })}
          />
          <OracleFilterRow
            columns={columns}
            filters={draft.filters}
            onChange={(filters) => patch({ filters })}
          />

          {/* --- Semântica de venda --- */}
          {columnsData?.supportsSalesFilter && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Label className="text-[10px] text-muted-foreground">
                Tipo de venda
              </Label>
              <Select
                value={draft.salesFilter ?? "valid"}
                onValueChange={(value) =>
                  patch({
                    salesFilter: value as "valid" | "invoiced" | "none",
                  })
                }
              >
                <SelectTrigger className="h-7 w-44 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SALES_FILTER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-[10px] text-muted-foreground">
                {
                  SALES_FILTER_OPTIONS.find(
                    (option) => option.value === (draft.salesFilter ?? "valid"),
                  )?.hint
                }
              </span>
            </div>
          )}

          {/* --- Limite --- */}
          {draft.groupBy.kind !== "none" && (
            <div className="flex items-center gap-1.5">
              <Label className="text-[10px] text-muted-foreground">
                Máx. de linhas
              </Label>
              <Input
                type="number"
                min={1}
                max={200}
                className="h-7 w-20 text-xs"
                value={draft.limit}
                onChange={(event) =>
                  patch({ limit: Number(event.target.value) || 20 })
                }
              />
            </div>
          )}

          {/* --- Teste --- */}
          <div className="flex flex-col gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 w-fit text-xs"
              disabled={preview.isPending || !draft.table}
              onClick={() => {
                setResult(null);
                preview.mutate(
                  {
                    config: draft,
                    displayType: (displayType === "MAP"
                      ? "STAT"
                      : displayType) as "STAT" | "CHART" | "LIST" | "TABLE",
                  },
                  {
                    onSuccess: (data) =>
                      setResult({
                        ok: data.ok,
                        message: data.message,
                        warnings: data.warnings,
                      }),
                    onError: (error) =>
                      setResult({
                        ok: false,
                        message: error.message,
                        warnings: [],
                      }),
                  },
                );
              }}
            >
              {preview.isPending && <Loader2 className="size-3 animate-spin" />}
              Testar consulta
            </Button>

            {result && (
              <div
                className={cn(
                  "flex items-start gap-1.5 rounded-md border p-2 text-[11px]",
                  result.ok
                    ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                    : "border-destructive/40 text-destructive",
                )}
              >
                {result.ok ? (
                  <CheckCircle2 className="mt-0.5 size-3 shrink-0" />
                ) : (
                  <XCircle className="mt-0.5 size-3 shrink-0" />
                )}
                <span>{result.message}</span>
              </div>
            )}
            {result?.warnings.map((warning) => (
              <Badge
                key={warning}
                variant="secondary"
                className="w-fit text-[10px] font-normal text-amber-700 dark:text-amber-400"
              >
                {warning}
              </Badge>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
