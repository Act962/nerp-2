import { z } from "zod";
import { HEX_COLOR_RE, PASTEL_COLORS, type WidgetColor } from "./pastel-colors";

// Personalização visual do widget além da cor de fundo do card (`color`) e do
// ícone (`icon`). Vive em `options.appearance` para não bagunçar colunas do
// Prisma com 5 knobs opcionais — mesma decisão de composição usada em
// `options.oracle` e `options.targetValue`.
//
// Cores aceitam: chave da paleta OU hex `#rrggbb` (conta-gotas). Qualquer
// outra string é rejeitada pelo schema — sem espaço para `red`, `linear-
// gradient(...)` ou coisa que possa virar CSS injection.
//
// Alinhamento vale para textos que o widget renderiza: título (moldura) e
// valor (StatWidget). Chart/List/Table/Map não expõem "um texto principal",
// então lá o alinhamento é ignorado por escolha, não por esquecimento.

export type WidgetAlign = "left" | "center" | "right";

// Escala tamanho relativa. "md" bate com o comportamento antigo — assim
// widgets pré-existentes continuam idênticos sem migração de dados. As outras
// escalas são discretas de propósito: livre o usuário digita 14.375px e o
// card fica desalinhado dos vizinhos.
export type WidgetTextSize = "sm" | "md" | "lg" | "xl";
export type WidgetTextWeight = "normal" | "medium" | "semibold" | "bold";

// Moldura do card. "tint"/"top" = comportamento antigo (fundo lavado na cor +
// borda grossa no topo). Para chegar no visual "control center" (card escuro,
// borda fina, cor só no acento) usa-se `background: "none"` + `border: "full"`.
export type WidgetBackground = "tint" | "none";
export type WidgetBorder = "top" | "full" | "none";

export interface WidgetAppearance {
  titleAlign: WidgetAlign;
  titleColor: WidgetColor | null;
  titleSize: WidgetTextSize;
  titleWeight: WidgetTextWeight;
  valueAlign: WidgetAlign;
  valueColor: WidgetColor | null;
  valueSize: WidgetTextSize;
  valueWeight: WidgetTextWeight;
  iconColor: WidgetColor | null;
  background: WidgetBackground;
  border: WidgetBorder;
  /** Cor do contorno; null = deriva da cor do card (`color`). */
  borderColor: WidgetColor | null;
}

export const DEFAULT_APPEARANCE: WidgetAppearance = {
  titleAlign: "left",
  titleColor: null,
  // Rodapé do card: "sm" = text-xs, "medium" — a mesma classe do design antigo.
  titleSize: "sm",
  titleWeight: "medium",
  valueAlign: "left",
  valueColor: null,
  // Número grande: "md" == clamp(1rem, 8cqw, 1.75rem) do StatWidget original.
  valueSize: "md",
  valueWeight: "semibold",
  iconColor: null,
  background: "tint",
  border: "top",
  borderColor: null,
};

const PASTEL_KEYS = PASTEL_COLORS.map((color) => color.key) as [
  string,
  ...string[],
];

const alignSchema = z.enum(["left", "center", "right"]);
const sizeSchema = z.enum(["sm", "md", "lg", "xl"]);
const weightSchema = z.enum(["normal", "medium", "semibold", "bold"]);
// nullable + default: qualquer campo omitido vira null (= tema padrão do card).
// União aceita tanto uma key da paleta quanto um hex livre do conta-gotas —
// se vier outra coisa (`red`, `blue`, garbage) o schema falha e a leitura cai
// para o default. Nunca chega no inline style.
const widgetColorSchema = z
  .union([z.enum(PASTEL_KEYS), z.string().regex(HEX_COLOR_RE)])
  .nullable()
  .default(null);

const backgroundSchema = z.enum(["tint", "none"]).default("tint");
const borderSchema = z.enum(["top", "full", "none"]).default("top");

export const widgetAppearanceSchema = z.object({
  titleAlign: alignSchema.default("left"),
  titleColor: widgetColorSchema,
  titleSize: sizeSchema.default("sm"),
  titleWeight: weightSchema.default("medium"),
  valueAlign: alignSchema.default("left"),
  valueColor: widgetColorSchema,
  valueSize: sizeSchema.default("md"),
  valueWeight: weightSchema.default("semibold"),
  iconColor: widgetColorSchema,
  background: backgroundSchema,
  border: borderSchema,
  borderColor: widgetColorSchema,
});

/**
 * Lê e valida a appearance guardada em `widget.options` — devolve os defaults
 * quando ausente ou malformado. Feito no cliente porque `options` chega como
 * `unknown` do banco e o renderer precisa de tipo concreto.
 */
export function readAppearance(options: unknown): WidgetAppearance {
  const raw = (options as { appearance?: unknown } | null)?.appearance;
  if (!raw) return DEFAULT_APPEARANCE;
  const parsed = widgetAppearanceSchema.safeParse(raw);
  if (!parsed.success) return DEFAULT_APPEARANCE;
  return {
    titleAlign: parsed.data.titleAlign,
    titleColor: parsed.data.titleColor as WidgetColor | null,
    titleSize: parsed.data.titleSize,
    titleWeight: parsed.data.titleWeight,
    valueAlign: parsed.data.valueAlign,
    valueColor: parsed.data.valueColor as WidgetColor | null,
    valueSize: parsed.data.valueSize,
    valueWeight: parsed.data.valueWeight,
    iconColor: parsed.data.iconColor as WidgetColor | null,
    background: parsed.data.background,
    border: parsed.data.border,
    borderColor: parsed.data.borderColor as WidgetColor | null,
  };
}

/**
 * Verdadeiro quando a appearance mudou de fábrica — usado por `buildOptions`
 * pra não gravar `appearance: {defaults}` (payload menor no banco e no wire).
 */
export function hasCustomAppearance(appearance: WidgetAppearance): boolean {
  return (
    appearance.titleAlign !== DEFAULT_APPEARANCE.titleAlign ||
    appearance.titleColor !== DEFAULT_APPEARANCE.titleColor ||
    appearance.titleSize !== DEFAULT_APPEARANCE.titleSize ||
    appearance.titleWeight !== DEFAULT_APPEARANCE.titleWeight ||
    appearance.valueAlign !== DEFAULT_APPEARANCE.valueAlign ||
    appearance.valueColor !== DEFAULT_APPEARANCE.valueColor ||
    appearance.valueSize !== DEFAULT_APPEARANCE.valueSize ||
    appearance.valueWeight !== DEFAULT_APPEARANCE.valueWeight ||
    appearance.iconColor !== DEFAULT_APPEARANCE.iconColor ||
    appearance.background !== DEFAULT_APPEARANCE.background ||
    appearance.border !== DEFAULT_APPEARANCE.border ||
    appearance.borderColor !== DEFAULT_APPEARANCE.borderColor
  );
}

/** Classe Tailwind de text-align a partir do alinhamento. */
export function alignClass(align: WidgetAlign): string {
  return align === "center"
    ? "text-center"
    : align === "right"
      ? "text-right"
      : "text-left";
}

/** Classe justify-content quando o texto está numa flex row. */
export function justifyClass(align: WidgetAlign): string {
  return align === "center"
    ? "justify-center"
    : align === "right"
      ? "justify-end"
      : "justify-start";
}

// Tamanho do TÍTULO: escala fixa, aplicada como classe Tailwind. O título é
// texto pequeno de rodapé — não precisa da escala responsiva do número.
const TITLE_SIZE_CLASS: Record<WidgetTextSize, string> = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
  xl: "text-lg",
};

export function titleSizeClass(size: WidgetTextSize): string {
  return TITLE_SIZE_CLASS[size];
}

// Tamanho do VALOR: multiplicador aplicado sobre o mesmo `clamp` responsivo
// do StatWidget original. Preserva o comportamento de encolher/crescer com o
// tamanho do card (@container) — o usuário só sobe/desce a "faixa" da escala.
// "md" = clamp(1rem, 8cqw, 1.75rem), idêntico ao design antigo.
const VALUE_SIZE_MULTIPLIER: Record<WidgetTextSize, number> = {
  sm: 0.75,
  md: 1,
  lg: 1.25,
  xl: 1.5,
};

export function valueFontSize(size: WidgetTextSize): string {
  const m = VALUE_SIZE_MULTIPLIER[size];
  return `clamp(${1 * m}rem, ${8 * m}cqw, ${1.75 * m}rem)`;
}

const WEIGHT_CLASS: Record<WidgetTextWeight, string> = {
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
};

export function weightClass(weight: WidgetTextWeight): string {
  return WEIGHT_CLASS[weight];
}

// Rótulos para a UI — mantidos aqui para não duplicar entre picker/edit sheet.
export const TEXT_SIZE_LABEL: Record<WidgetTextSize, string> = {
  sm: "Pequeno",
  md: "Médio",
  lg: "Grande",
  xl: "Extra",
};

export const TEXT_WEIGHT_LABEL: Record<WidgetTextWeight, string> = {
  normal: "Normal",
  medium: "Médio",
  semibold: "Semibold",
  bold: "Negrito",
};
