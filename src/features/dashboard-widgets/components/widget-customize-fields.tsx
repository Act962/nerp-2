"use client";

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
  allowedDisplayTypes,
  describeOracleQuery,
  ORACLE_CUSTOM_KEY,
} from "../lib/oracle-query-config";
import { PASTEL_COLORS, type PastelColorKey } from "../lib/pastel-colors";
import { WIDGET_ICONS } from "../lib/widget-icons";
import {
  EMPTY_ORACLE_DRAFT,
  type OracleDraft,
  OracleQueryBuilder,
} from "./oracle-query-builder";

export const DISPLAY_TYPE_LABEL: Record<string, string> = {
  STAT: "Número",
  CHART: "Gráfico",
  LIST: "Lista",
  MAP: "Mapa",
  TABLE: "Tabela",
};

export const CHART_KIND_LABEL: Record<string, string> = {
  LINE: "Linha",
  BAR: "Barra",
  DONUT: "Rosca",
};

export type DisplayType = "STAT" | "CHART" | "LIST" | "MAP" | "TABLE";
export type ChartKind = "LINE" | "BAR" | "DONUT";

export interface CustomizeEntry {
  key?: string;
  /** Rótulo padrão da fonte — vira o placeholder do campo de nome. */
  label?: string;
  supportedDisplayTypes: readonly DisplayType[];
  supportedChartKinds: readonly ChartKind[];
}

export interface CustomizeState {
  displayType: DisplayType;
  chartKind: ChartKind;
  color: PastelColorKey | null;
  icon: string | null;
  // Controlado como string pra permitir campo vazio/parcial durante a
  // digitação — parseado só na hora de salvar.
  targetValue: string;
  /** Vazio = usa o rótulo padrão da fonte. */
  title: string;
  /** Só para a entrada `oracle.custom`. */
  oracle: OracleDraft | null;
}

/**
 * Monta o `options` do widget a partir do estado do formulário. Compartilhado
 * pelos dois fluxos (adicionar e editar) para os dois gravarem o mesmo shape.
 */
export function buildOptions(
  state: CustomizeState,
  targetValue: number,
): Record<string, unknown> | null {
  const options: Record<string, unknown> = {};
  if (state.oracle) options.oracle = state.oracle;
  if (
    state.displayType === "STAT" &&
    Number.isFinite(targetValue) &&
    targetValue > 0
  ) {
    options.targetValue = targetValue;
  }
  return Object.keys(options).length > 0 ? options : null;
}

export function ColorSwatchPicker({
  value,
  onChange,
}: {
  value: PastelColorKey | null;
  onChange: (key: PastelColorKey | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <button
        type="button"
        title="Sem cor"
        onClick={() => onChange(null)}
        className={cn(
          "size-5 shrink-0 rounded-full border-2 bg-transparent",
          value === null ? "border-foreground" : "border-muted-foreground/30",
        )}
      />
      {PASTEL_COLORS.map((color) => (
        <button
          key={color.key}
          type="button"
          title={color.label}
          onClick={() => onChange(color.key)}
          style={{ background: color.hex }}
          className={cn(
            "size-5 shrink-0 rounded-full border-2 transition-transform",
            value === color.key
              ? "border-foreground scale-110"
              : "border-transparent",
          )}
        />
      ))}
    </div>
  );
}

export function IconSwatchPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (key: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <button
        type="button"
        title="Sem ícone"
        onClick={() => onChange(null)}
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-md border-2 text-[10px] text-muted-foreground",
          value === null
            ? "border-foreground"
            : "border-transparent bg-muted/50",
        )}
      >
        —
      </button>
      {WIDGET_ICONS.map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          title={label}
          onClick={() => onChange(key)}
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-md border-2 bg-muted/50",
            value === key ? "border-foreground" : "border-transparent",
          )}
        >
          <Icon className="size-3.5" />
        </button>
      ))}
    </div>
  );
}

// Campos de personalização de UM widget — compartilhado entre "Adicionar
// widget" (widget-picker-sheet.tsx, antes de criar) e a edição de um widget
// já criado (widget-edit-sheet.tsx), pra não duplicar a UI nos dois lugares.
export function WidgetCustomizeFields({
  entry,
  state,
  onChange,
}: {
  entry: CustomizeEntry;
  state: CustomizeState;
  onChange: (next: Partial<CustomizeState>) => void;
}) {
  const isOracle = entry.key === ORACLE_CUSTOM_KEY;
  const draft = state.oracle ?? EMPTY_ORACLE_DRAFT;
  // Numa consulta customizada quem manda nas formas de exibição possíveis é a
  // própria consulta (1 medida sem agrupamento só pode ser número; N medidas
  // só cabem em tabela), não a entrada estática do catálogo.
  const displayTypes = isOracle
    ? allowedDisplayTypes(draft)
    : entry.supportedDisplayTypes;

  // Placeholder mostra o nome que o widget terá se o campo ficar vazio: para
  // consulta do Oracle, um resumo da própria consulta ("Receita por Filial")
  // em vez do genérico "Consulta personalizada".
  const defaultTitle =
    (isOracle && state.oracle ? describeOracleQuery(state.oracle) : null) ??
    entry.label ??
    "Widget";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <Label className="text-[10px] text-muted-foreground">
          Nome do widget
        </Label>
        <Input
          className="h-7 text-xs"
          placeholder={defaultTitle}
          maxLength={60}
          value={state.title}
          onChange={(event) => onChange({ title: event.target.value })}
        />
      </div>
      {isOracle && (
        <OracleQueryBuilder
          draft={draft}
          displayType={state.displayType}
          onChange={(next) => {
            const allowed = allowedDisplayTypes(next);
            onChange({
              oracle: next,
              // Se a mudança na consulta tornou a exibição atual impossível,
              // corrige em vez de deixar o usuário salvar e tomar erro.
              ...(allowed.includes(state.displayType)
                ? {}
                : { displayType: allowed[0] as DisplayType }),
            });
          }}
          onApplyTemplate={({ config, displayType, name }) =>
            onChange({
              oracle: config,
              displayType: displayType as DisplayType,
              // Só sugere o nome do modelo se o usuário ainda não digitou o
              // dele — aplicar um modelo não deve apagar o que ele escreveu.
              ...(state.title.trim() ? {} : { title: name }),
            })
          }
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        {displayTypes.length > 1 && (
          <Select
            value={state.displayType}
            onValueChange={(value) =>
              onChange({ displayType: value as DisplayType })
            }
          >
            <SelectTrigger className="h-7 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {displayTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {DISPLAY_TYPE_LABEL[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {state.displayType === "CHART" &&
          entry.supportedChartKinds.length > 1 && (
            <Select
              value={state.chartKind}
              onValueChange={(value) =>
                onChange({ chartKind: value as ChartKind })
              }
            >
              <SelectTrigger className="h-7 w-24 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {entry.supportedChartKinds.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {CHART_KIND_LABEL[kind]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">Cor</span>
          <ColorSwatchPicker
            value={state.color}
            onChange={(color) => onChange({ color })}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">Ícone</span>
          <IconSwatchPicker
            value={state.icon}
            onChange={(icon) => onChange({ icon })}
          />
        </div>
      </div>
      {state.displayType === "STAT" && (
        <div className="flex items-center gap-1.5">
          <Label className="shrink-0 text-[10px] text-muted-foreground">
            Meta (opcional)
          </Label>
          <Input
            type="text"
            inputMode="decimal"
            placeholder="Ex.: 5000"
            className="h-7 w-28 text-xs"
            value={state.targetValue}
            onChange={(event) => onChange({ targetValue: event.target.value })}
          />
        </div>
      )}
    </div>
  );
}
