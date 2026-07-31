import { z } from "zod";
import { HEX_COLOR_RE, PASTEL_COLORS, type WidgetColor } from "./pastel-colors";

// Alerta configurado por widget. Vive em `options.alert` para não migrar o
// schema Prisma com 6 colunas opcionais — mesma decisão de composição usada
// em `options.oracle`, `options.targetValue`, `options.appearance`.
//
// Disparo: um cron do Inngest que roda de X em X minutos verifica, para cada
// widget habilitado, se o horário configurado caiu na última janela e se o
// valor bate a condição. Sem polling no cliente e sem cron por widget
// (Inngest paga um por função, não por linha) — a fan-out é interna à função.
//
// Persistência do "disparou": `lastFiredAt` e `lastFiredValue` são gravados
// no próprio `options.alert`. Não precisa de tabela nova; deduplicação usa a
// data (não dispara duas vezes no mesmo dia). A recepção do usuário
// (acknowledge) é local ao navegador — localStorage em vez de tabela — pra
// evitar uma migration nesta iteração.

/** Diferença aceita entre horário programado e o disparo real do cron. */
export const ALERT_TOLERANCE_MINUTES = 6;

export type WidgetAlertComparator = "lt" | "lte" | "gt" | "gte";

export interface WidgetAlert {
  enabled: boolean;
  /** "HH:mm" (24h) no fuso da organização (fallback America/Fortaleza). */
  time: string;
  /** 0 = domingo, 6 = sábado. Vazio = todos os dias. */
  daysOfWeek: number[];
  /** Compara o valor ATUAL do widget contra `threshold`. */
  comparator: WidgetAlertComparator;
  /** Alvo numérico. Quando `useTargetValue` = true, usa o `targetValue` do
   * widget (Meta) e este campo é ignorado. */
  threshold: number;
  useTargetValue: boolean;
  /** Mensagem mostrada no popup — livre, com placeholders {{valor}} e
   * {{meta}} interpolados no cliente. */
  message: string;
  /** Cor do card enquanto o alerta está ativo (chave da paleta OU hex). */
  color: WidgetColor | null;
  /** ISO datetime da última vez que o alerta disparou. Escrito pelo cron. */
  lastFiredAt: string | null;
  /** Valor observado no momento do disparo. Usado no popup e no card. */
  lastFiredValue: number | null;
  /** Toca um som quando o alerta dispara — se o navegador permitir. */
  playSound: boolean;
  /**
   * Notificação do SISTEMA (fora da aba). Requer o usuário conceder a
   * permissão via `Notification.requestPermission()` no dashboard.
   */
  showNotification: boolean;
}

export const DEFAULT_ALERT: WidgetAlert = {
  enabled: false,
  time: "14:00",
  daysOfWeek: [1, 2, 3, 4, 5],
  comparator: "lt",
  threshold: 0,
  useTargetValue: true,
  message: "Valor atual ({{valor}}) está fora da meta ({{meta}}).",
  color: "coral",
  lastFiredAt: null,
  lastFiredValue: null,
  playSound: false,
  showNotification: false,
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
  enabled: z.boolean().default(false),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário no formato HH:mm.")
    .default("14:00"),
  daysOfWeek: z
    .array(z.number().int().min(0).max(6))
    .max(7)
    .default([1, 2, 3, 4, 5]),
  comparator: z.enum(["lt", "lte", "gt", "gte"]).default("lt"),
  threshold: z.number().default(0),
  useTargetValue: z.boolean().default(true),
  message: z.string().max(200).default(DEFAULT_ALERT.message),
  color: widgetColorSchema,
  lastFiredAt: z.string().datetime().nullable().default(null),
  lastFiredValue: z.number().nullable().default(null),
  playSound: z.boolean().default(false),
  showNotification: z.boolean().default(false),
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

export function hasCustomAlert(alert: WidgetAlert): boolean {
  return alert.enabled;
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

/** Aplica a comparação; devolve `null` quando o valor não é numérico. */
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

/** Renderiza {{valor}} e {{meta}} no template — parcial, sem lib. */
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
