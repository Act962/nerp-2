"use client";

import { useState, type ReactNode } from "react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Database,
  Filter,
  GripVertical,
  Layers,
  Loader2,
  PlayCircle,
  Plus,
  Sigma,
  Sliders,
  X,
  XCircle,
} from "lucide-react";
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
  type OracleQueryMeasure,
} from "../lib/oracle-query-config";
import type { ReportTableConfig } from "../lib/report-table";
import { OracleFilterRow, OracleQuickFilterChips } from "./oracle-filter-row";
import { OracleTemplatePicker } from "./oracle-template-picker";
import { OracleTermOption } from "./oracle-term-option";

type OracleColumnInfo = NonNullable<
  ReturnType<typeof useOracleColumns>["data"]
>["columns"][number];

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

// Data de hoje em ISO YYYY-MM-DD no fuso local — bater com o formato que o
// `<input type="date">` produz e o schema exige, sem depender de UTC.
function today(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Bloco titulado do montador Oracle: barra com ícone + rótulo curto (em vez
// dos "campos soltos" antigos) e um corpo com espaçamento próprio. O cabeçalho
// é um botão de recolher — a lista de seções ficava longa, então recolher o
// que já está pronto ajuda a focar no que falta ajustar.
//
// Ícones sem cor por bloco — a cor era o que "misturava" visualmente no design
// anterior. Aqui todos vêm no tom do texto.
function OracleSection({
  icon: Icon,
  title,
  aside,
  defaultCollapsed = true,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  aside?: ReactNode;
  defaultCollapsed?: boolean;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const contentId = `oracle-section-${title.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <section className="flex flex-col rounded-md border bg-background">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!collapsed}
          aria-controls={contentId}
          className="-mx-1 flex flex-1 items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-muted/40"
        >
          <ChevronDown
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground transition-transform",
              collapsed && "-rotate-90",
            )}
          />
          <Icon className="size-3.5 text-muted-foreground" />
          <h5 className="font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
            {title}
          </h5>
        </button>
        {aside}
      </div>
      {!collapsed && (
        <div id={contentId} className="flex flex-col gap-2 px-3 pt-0 pb-3">
          {children}
        </div>
      )}
    </section>
  );
}

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

// Uma medida arrastável dentro de "Cálculo". A ordem do array de medidas É a
// ordem das colunas no resultado (M0, M1…) — arrastar aqui reordena a
// consulta de verdade, então widgets já configurados com `report.valueKey`/
// `costKey` etc. (que referenciam M0/M1/… por posição) podem precisar de
// ajuste manual depois de reordenar.
function OracleMeasureRow({
  id,
  index,
  measure,
  canRemove,
  measureColumns,
  columns,
  isLargeTable,
  onChange,
  onRemove,
}: {
  id: string;
  index: number;
  measure: OracleQueryMeasure;
  canRemove: boolean;
  measureColumns: OracleColumnInfo[];
  columns: OracleColumnInfo[];
  isLargeTable: boolean;
  onChange: (next: Partial<OracleQueryMeasure>) => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex flex-col gap-1.5 rounded-md border bg-background p-2",
        isDragging && "z-10 opacity-50",
      )}
    >
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="-ml-1 flex size-6 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-muted active:cursor-grabbing"
          title="Arraste para reordenar a coluna"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </button>
        <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
          Medida {index + 1}
        </span>
        {canRemove && (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="ml-auto text-muted-foreground hover:text-destructive"
            onClick={onRemove}
            aria-label={`Remover Medida ${index + 1}`}
          >
            <X className="size-3" />
          </Button>
        )}
      </div>

      {/* Duas colunas fixas (agregação/unidade) — sempre cabem lado a lado
       * mesmo na largura estreita do Sheet. Coluna e rótulo ficam em linhas
       * próprias, largura cheia, porque o nome da coluna Oracle pode ser
       * longo. */}
      <div className="flex gap-1.5">
        <Select
          value={measure.aggregation}
          onValueChange={(value) =>
            onChange({
              aggregation: value as OracleAggregation,
              column: value === "COUNT" ? null : (measure.column ?? null),
            })
          }
        >
          <SelectTrigger
            className="h-7 min-w-0 flex-1 text-xs"
            aria-label="Agregação"
          >
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

        <Select
          value={measure.unit}
          onValueChange={(value) =>
            onChange({ unit: value as "currency" | "number" | "percent" })
          }
        >
          <SelectTrigger
            className="h-7 min-w-0 flex-1 text-xs"
            aria-label="Unidade"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="number">Número</SelectItem>
            <SelectItem value="currency">R$</SelectItem>
            <SelectItem value="percent">%</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {measure.aggregation !== "COUNT" && (
        <Select
          value={measure.column ?? ""}
          onValueChange={(value) => onChange({ column: value })}
        >
          <SelectTrigger
            className="h-7 w-full min-w-0 text-xs"
            aria-label="Coluna"
          >
            <SelectValue placeholder="coluna" />
          </SelectTrigger>
          <SelectContent>
            {(measureColumns.length > 0 ? measureColumns : columns).map(
              (column) => (
                <SelectItem key={column.name} value={column.name}>
                  <OracleTermOption
                    code={column.name}
                    label={column.label}
                    description={column.description}
                  />
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
      )}

      <Input
        className="h-7 w-full text-xs"
        placeholder="rótulo"
        aria-label="Rótulo da medida"
        value={measure.label}
        onChange={(event) => onChange({ label: event.target.value })}
      />
    </div>
  );
}

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
    /** Colunas derivadas (% Part., Contrib., % Lucro…) do modelo aplicado. */
    report?: ReportTableConfig;
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

  // Ordem das medidas = ordem das colunas no resultado (M0, M1…) — arrastar
  // aqui reordena de verdade a consulta, não é só cosmético. Usa o ÍNDICE
  // como id de arraste: como a medida em si não tem um id próprio e o array
  // só é reordenado (nunca mutado) durante o gesto, isso é suficiente e evita
  // ter que manter uma lista de ids em sincronia com adicionar/remover/trocar
  // de tabela (que substitui `measures` inteiro vindo de fora).
  const measureSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const handleMeasureDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = Number(active.id);
    const newIndex = Number(over.id);
    patch({ measures: arrayMove(draft.measures, oldIndex, newIndex) });
  };

  return (
    <div className="flex flex-col gap-3 rounded-md border bg-muted/30 p-3">
      <OracleTemplatePicker
        availableTables={(tablesData?.tables ?? []).map((table) => table.name)}
        currentConfig={draft}
        currentDisplayType={displayType}
        onApply={(payload) => {
          setResult(null);
          onApplyTemplate(payload);
        }}
      />

      <OracleSection icon={Database} title="Fonte">
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
      </OracleSection>

      {draft.table && (
        <>
          <OracleSection
            icon={Sigma}
            title="Cálculo"
            aside={
              draft.measures.length < 6 && (
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
                  <Plus className="size-3" /> Adicionar medida
                </Button>
              )
            }
          >
            <DndContext
              sensors={measureSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleMeasureDragEnd}
            >
              <SortableContext
                items={draft.measures.map((_, index) => String(index))}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-2">
                  {draft.measures.map((measure, index) => (
                    <OracleMeasureRow
                      key={index}
                      id={String(index)}
                      index={index}
                      measure={measure}
                      canRemove={draft.measures.length > 1}
                      measureColumns={measureColumns}
                      columns={columns}
                      isLargeTable={isLargeTable}
                      onChange={(next) => {
                        const measures = [...draft.measures];
                        measures[index] = { ...measure, ...next };
                        patch({ measures });
                      }}
                      onRemove={() =>
                        patch({
                          measures: draft.measures.filter(
                            (_, position) => position !== index,
                          ),
                        })
                      }
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </OracleSection>

          <OracleSection icon={Layers} title="Agrupar por">
            <div className="flex flex-wrap items-center gap-1.5">
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
                <SelectTrigger className="h-8 min-w-0 flex-1 text-xs sm:w-44 sm:flex-none">
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
                  <SelectTrigger className="h-8 w-24 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Por dia</SelectItem>
                    <SelectItem value="month">Por mês</SelectItem>
                  </SelectContent>
                </Select>
              )}

              {draft.groupBy.kind !== "none" && (
                <div className="ml-auto flex items-center gap-1.5">
                  <Label className="text-[10px] text-muted-foreground">
                    Máx. de linhas
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={200}
                    className="h-8 w-20 text-xs"
                    value={draft.limit}
                    onChange={(event) =>
                      patch({ limit: Number(event.target.value) || 20 })
                    }
                  />
                </div>
              )}
            </div>
          </OracleSection>

          <OracleSection
            icon={CalendarDays}
            title="Período"
            aside={
              isLargeTable &&
              !draft.dateFilter && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400">
                  Obrigatório nesta tabela.
                </span>
              )
            }
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <Select
                value={draft.dateFilter?.column ?? ""}
                onValueChange={(value) =>
                  patch({
                    dateFilter: {
                      ...(draft.dateFilter ?? {}),
                      column: value,
                      preset: draft.dateFilter?.preset ?? "last30",
                    },
                  })
                }
              >
                <SelectTrigger className="h-8 min-w-0 flex-1 text-xs sm:w-40 sm:flex-none">
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
                  onValueChange={(value) => {
                    const preset = value as OracleDatePreset;
                    // Ao ligar/desligar o "custom" mantemos os campos from/to
                    // que já tenham sido digitados — só remove ao voltar para
                    // preset fixo, senão ficam presos no schema mesmo sem uso.
                    patch({
                      dateFilter:
                        preset === "custom"
                          ? {
                              column: draft.dateFilter?.column ?? "",
                              preset,
                              from: draft.dateFilter?.from ?? today(),
                              to: draft.dateFilter?.to ?? today(),
                            }
                          : {
                              column: draft.dateFilter?.column ?? "",
                              preset,
                            },
                    });
                  }}
                >
                  <SelectTrigger className="h-8 w-40 text-xs">
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
            </div>

            {draft.dateFilter?.preset === "custom" && (
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] text-muted-foreground">
                    De
                  </Label>
                  <Input
                    type="date"
                    className="h-8 w-40 text-xs"
                    value={draft.dateFilter.from ?? ""}
                    max={draft.dateFilter.to || undefined}
                    onChange={(event) =>
                      patch({
                        dateFilter: {
                          ...draft.dateFilter,
                          column: draft.dateFilter?.column ?? "",
                          preset: "custom",
                          from: event.target.value,
                          to: draft.dateFilter?.to ?? event.target.value,
                        },
                      })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] text-muted-foreground">
                    Até
                  </Label>
                  <Input
                    type="date"
                    className="h-8 w-40 text-xs"
                    value={draft.dateFilter.to ?? ""}
                    min={draft.dateFilter.from || undefined}
                    onChange={(event) =>
                      patch({
                        dateFilter: {
                          ...draft.dateFilter,
                          column: draft.dateFilter?.column ?? "",
                          preset: "custom",
                          from: draft.dateFilter?.from ?? event.target.value,
                          to: event.target.value,
                        },
                      })
                    }
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Inclui os dois dias — o "até" é a última data que entra.
                </p>
              </div>
            )}
          </OracleSection>

          <OracleSection icon={Filter} title="Filtros">
            <div className="flex flex-col gap-2">
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
            </div>
          </OracleSection>

          {columnsData?.supportsSalesFilter && (
            <OracleSection icon={Sliders} title="Ajustes">
              <div className="flex flex-col gap-1.5">
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
                  <SelectTrigger className="h-8 w-full text-xs sm:w-56">
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
                      (option) =>
                        option.value === (draft.salesFilter ?? "valid"),
                    )?.hint
                  }
                </span>
              </div>
            </OracleSection>
          )}

          <OracleSection icon={PlayCircle} title="Testar consulta">
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 w-fit gap-1.5 text-xs"
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
                {preview.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <PlayCircle className="size-3.5" />
                )}
                Rodar consulta de teste
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
                  className="w-fit font-normal text-[10px] text-amber-700 dark:text-amber-400"
                >
                  {warning}
                </Badge>
              ))}
            </div>
          </OracleSection>
        </>
      )}
    </div>
  );
}
