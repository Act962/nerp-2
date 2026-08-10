import { z } from "zod";
import { HEX_COLOR_RE, PASTEL_COLORS, type WidgetColor } from "./pastel-colors";
import type { WidgetValue } from "./widget-value";

/** Diferença aceita entre horário programado e o disparo real do cron. */
export const ALERT_TOLERANCE_MINUTES = 6;

export type WidgetAlertComparator = "lt" | "lte" | "gt" | "gte";

export interface WidgetAlert {
  id: string;
  enabled: boolean;
  label: string;
  time: string;
  daysOfWeek: number[];
  startDate: string | null;
  endDate: string | null;
  comparator: WidgetAlertComparator;
  threshold: number;
  useTargetValue: boolean;
  message: string;
  color: WidgetColor | null;
  lastFiredAt: string | null;
  lastFiredValue: number | null;
  playSound: boolean;
  showNotification: boolean;
  /** Coluna-alvo em widgets TABLE (ex: "M0", "M1"). null = todas as colunas. */
  measureKey: string | null;
}

let alertCounter = 0;
export function newAlertId(): string {
  return `alert_${Date.now()}_${++alertCounter}`;
}

export function createDefaultAlert(): WidgetAlert {
  return {
    id: newAlertId(),
    enabled: true,
    label: "",
    time: "14:00",
    daysOfWeek: [1, 2, 3, 4, 5],
    startDate: null,
    endDate: null,
    comparator: "lt",
    threshold: 0,
    useTargetValue: false,
    message: "Valor atual ({{valor}}) está fora da meta ({{meta}}).",
    color: "coral",
    lastFiredAt: null,
    lastFiredValue: null,
    playSound: false,
    showNotification: false,
    measureKey: null,
  };
}

export const DEFAULT_ALERT: WidgetAlert = {
  id: "default",
  enabled: false,
  label: "",
  time: "14:00",
  daysOfWeek: [1, 2, 3, 4, 5],
  startDate: null,
  endDate: null,
  comparator: "lt",
  threshold: 0,
  useTargetValue: true,
  message: "Valor atual ({{valor}}) está fora da meta ({{meta}}).",
  color: "coral",
  lastFiredAt: null,
  lastFiredValue: null,
  playSound: false,
  showNotification: false,
  measureKey: null,
};

const PASTEL_KEYS = PASTEL_COLORS.map((color) => color.key) as [
  string,
  ...string[],
];

const widgetColorSchema = z
  .union([z.enum(PASTEL_KEYS), z.string().regex(HEX_COLOR_RE)])
  .nullable()
  .default(null);

export const widgetAlertSchema = z.object({
  id: z.string().default("default"),
  enabled: z.boolean().default(false),
  label: z.string().max(100).default(""),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário no formato HH:mm.")
    .default("14:00"),
  daysOfWeek: z
    .array(z.number().int().min(0).max(6))
    .max(7)
    .default([1, 2, 3, 4, 5]),
  startDate: z.string().nullable().default(null),
  endDate: z.string().nullable().default(null),
  comparator: z.enum(["lt", "lte", "gt", "gte"]).default("lt"),
  threshold: z.number().default(0),
  useTargetValue: z.boolean().default(true),
  message: z.string().max(200).default(DEFAULT_ALERT.message),
  color: widgetColorSchema,
  lastFiredAt: z.string().datetime().nullable().default(null),
  lastFiredValue: z.number().nullable().default(null),
  playSound: z.boolean().default(false),
  showNotification: z.boolean().default(false),
  measureKey: z.string().nullable().default(null),
});

export function readAlert(options: unknown): WidgetAlert {
  const raw = (options as { alert?: unknown } | null)?.alert;
  if (!raw) return DEFAULT_ALERT;
  const parsed = widgetAlertSchema.safeParse(raw);
  if (!parsed.success) return DEFAULT_ALERT;
  return {
    ...parsed.data,
    color: parsed.data.color as WidgetColor | null,
  };
}

export function readAlerts(options: unknown): WidgetAlert[] {
  const opts = options as {
    alerts?: unknown[];
    alert?: unknown;
  } | null;
  if (opts?.alerts && Array.isArray(opts.alerts)) {
    return opts.alerts
      .map((raw) => {
        const parsed = widgetAlertSchema.safeParse(raw);
        if (!parsed.success) return null;
        return {
          ...parsed.data,
          color: parsed.data.color as WidgetColor | null,
        };
      })
      .filter((a): a is WidgetAlert => a !== null);
  }
  if (opts?.alert) {
    const parsed = widgetAlertSchema.safeParse(opts.alert);
    if (parsed.success) {
      return [
        {
          ...parsed.data,
          id: parsed.data.id || newAlertId(),
          color: parsed.data.color as WidgetColor | null,
        },
      ];
    }
  }
  return [];
}

export function hasCustomAlert(alert: WidgetAlert): boolean {
  return alert.enabled;
}

export function hasCustomAlerts(alerts: WidgetAlert[]): boolean {
  return alerts.some((a) => a.enabled);
}

const COMPARATOR_LABEL: Record<WidgetAlertComparator, string> = {
  lt: "abaixo de",
  lte: "abaixo ou igual a",
  gt: "acima de",
  gte: "acima ou igual a",
};

export const COMPARATOR_OPTIONS: Array<{
  key: WidgetAlertComparator;
  label: string;
}> = (Object.keys(COMPARATOR_LABEL) as WidgetAlertComparator[]).map((key) => ({
  key,
  label: COMPARATOR_LABEL[key],
}));

export function comparatorLabel(comparator: WidgetAlertComparator): string {
  return COMPARATOR_LABEL[comparator];
}

export function compareAlertValue(
  value: number,
  alert: WidgetAlert,
  target: number | null,
): boolean {
  const threshold = alert.useTargetValue ? target : alert.threshold;
  if (threshold === null || !Number.isFinite(threshold)) return false;
  switch (alert.comparator) {
    case "lt":
      return value < threshold;
    case "lte":
      return value <= threshold;
    case "gt":
      return value > threshold;
    case "gte":
      return value >= threshold;
  }
}

export function renderAlertMessage(
  template: string,
  values: { valor: string; meta: string },
): string {
  return template
    .replace(/\{\{\s*valor\s*\}\}/g, values.valor)
    .replace(/\{\{\s*meta\s*\}\}/g, values.meta);
}

const DAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export function daysOfWeekLabel(days: number[]): string {
  if (days.length === 0 || days.length === 7) return "Todo dia";
  const set = new Set(days);
  const weekdays = [1, 2, 3, 4, 5].every((d) => set.has(d));
  if (weekdays && days.length === 5) return "Dias úteis";
  return days
    .slice()
    .sort()
    .map((d) => DAY_SHORT[d])
    .join(", ");
}

export function formatAlertSummary(
  alert: WidgetAlert,
  measureLabel?: string | null,
): string {
  const comp = COMPARATOR_LABEL[alert.comparator];
  const ref = alert.useTargetValue
    ? "meta"
    : alert.threshold.toLocaleString("pt-BR");
  const days = daysOfWeekLabel(alert.daysOfWeek);
  const parts: string[] = [];
  if (measureLabel) parts.push(measureLabel);
  parts.push(`${comp} ${ref}`, `às ${alert.time}`, days);
  if (alert.startDate) parts.push(`de ${alert.startDate}`);
  if (alert.endDate) parts.push(`até ${alert.endDate}`);
  return parts.join(" · ");
}

function extractComparableValue(widgetValue: WidgetValue): number | null {
  switch (widgetValue.kind) {
    case "STAT":
      return widgetValue.value;
    case "LIST":
      return widgetValue.items.reduce((sum, item) => sum + item.value, 0);
    case "CHART":
      return widgetValue.series.reduce((sum, point) => sum + point.value, 0);
    case "TABLE": {
      const numColIdx = widgetValue.columns.findIndex(
        (col) => col.align === "right" && col.unit !== undefined,
      );
      if (numColIdx < 0) return null;
      return widgetValue.rows.reduce((sum, row) => {
        const cell = row.cells[numColIdx];
        return sum + (typeof cell === "number" ? cell : 0);
      }, 0);
    }
    case "MAP":
      if (widgetValue.scope === "field") return widgetValue.pins.length;
      return widgetValue.regions.reduce((sum, r) => sum + r.value, 0);
    case "FLEET":
      return widgetValue.trucks.length;
    case "FEED":
      return widgetValue.items.length;
  }
}

export interface EvaluatedAlert {
  active: boolean;
  color: WidgetColor | null;
  message: string | null;
}

function activeAlerts(alerts: WidgetAlert[]): WidgetAlert[] {
  const todayStr = new Date().toISOString().slice(0, 10);
  return alerts.filter((a) => {
    if (!a.enabled) return false;
    if (a.startDate && todayStr < a.startDate) return false;
    if (a.endDate && todayStr > a.endDate) return false;
    return true;
  });
}

export function evaluateAlerts(
  alerts: WidgetAlert[],
  widgetValue: WidgetValue | null | undefined,
  targetValue: number | null,
): EvaluatedAlert {
  if (!widgetValue || alerts.length === 0) {
    return { active: false, color: null, message: null };
  }
  const currentValue = extractComparableValue(widgetValue);
  if (currentValue === null) {
    return { active: false, color: null, message: null };
  }

  for (const alert of activeAlerts(alerts)) {
    if (compareAlertValue(currentValue, alert, targetValue)) {
      const message = renderAlertMessage(alert.message, {
        valor: currentValue.toLocaleString("pt-BR"),
        meta: (targetValue ?? alert.threshold).toLocaleString("pt-BR"),
      });
      return { active: true, color: alert.color, message };
    }
  }

  return { active: false, color: null, message: null };
}

export function evaluateCellValue(
  alerts: WidgetAlert[],
  cellValue: number,
  targetValue: number | null,
  columnKey: string | null,
): WidgetColor | null {
  for (const alert of activeAlerts(alerts)) {
    if (alert.measureKey && columnKey && alert.measureKey !== columnKey)
      continue;
    if (compareAlertValue(cellValue, alert, targetValue)) {
      return alert.color ?? "coral";
    }
  }
  return null;
}
