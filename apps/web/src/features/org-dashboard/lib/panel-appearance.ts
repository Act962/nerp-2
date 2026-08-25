import type { CSSProperties } from "react";
import { z } from "zod";
import {
  HEX_COLOR_RE,
  PASTEL_COLORS,
  pastelHex,
  type WidgetColor,
} from "@/features/dashboard-widgets/lib/pastel-colors";
import {
  titleSizeClass,
  weightClass,
  type WidgetBackground,
  type WidgetBorder,
  type WidgetTextSize,
  type WidgetTextWeight,
} from "@/features/dashboard-widgets/lib/widget-appearance";

// Personalização visual do PAINEL (grupo de widgets). Espelha a do widget mas
// aplica à moldura do painel e à tipografia do título do painel. Vive em
// `panel.appearance` (JSON) para não virar 6 colunas opcionais.

export interface PanelAppearance {
  background: WidgetBackground;
  // Cor de fundo desacoplada da cor de acento. Null = usa a cor de acento
  // (comportamento antigo — "tint" pega o `color` do painel). Definida =
  // fundo lavado nessa cor específica, sem afetar contorno/título.
  backgroundColor: WidgetColor | null;
  border: WidgetBorder;
  borderColor: WidgetColor | null;
  titleColor: WidgetColor | null;
  titleSize: WidgetTextSize;
  titleWeight: WidgetTextWeight;
}

export const DEFAULT_PANEL_APPEARANCE: PanelAppearance = {
  background: "tint",
  backgroundColor: null,
  border: "top",
  borderColor: null,
  titleColor: null,
  titleSize: "sm",
  titleWeight: "semibold",
};

const PASTEL_KEYS = PASTEL_COLORS.map((color) => color.key) as [
  string,
  ...string[],
];
const colorSchema = z
  .union([z.enum(PASTEL_KEYS), z.string().regex(HEX_COLOR_RE)])
  .nullable()
  .default(null);

export const panelAppearanceSchema = z.object({
  background: z.enum(["tint", "none"]).default("tint"),
  backgroundColor: colorSchema,
  border: z.enum(["top", "full", "none"]).default("top"),
  borderColor: colorSchema,
  titleColor: colorSchema,
  titleSize: z.enum(["sm", "md", "lg", "xl"]).default("sm"),
  titleWeight: z
    .enum(["normal", "medium", "semibold", "bold"])
    .default("semibold"),
});

export function readPanelAppearance(appearance: unknown): PanelAppearance {
  if (!appearance) return DEFAULT_PANEL_APPEARANCE;
  const parsed = panelAppearanceSchema.safeParse(appearance);
  if (!parsed.success) return DEFAULT_PANEL_APPEARANCE;
  return {
    background: parsed.data.background,
    backgroundColor: parsed.data.backgroundColor as WidgetColor | null,
    border: parsed.data.border,
    borderColor: parsed.data.borderColor as WidgetColor | null,
    titleColor: parsed.data.titleColor as WidgetColor | null,
    titleSize: parsed.data.titleSize,
    titleWeight: parsed.data.titleWeight,
  };
}

/**
 * Estilos da moldura do painel a partir da cor de acento + aparência. Usado
 * IDÊNTICO no editor e na view, pra o painel personalizado sair igual nos dois.
 */
export function panelStyles(
  color: string | null,
  appearance: PanelAppearance,
): {
  sectionStyle: CSSProperties;
  noBorder: boolean;
  headerStyle: CSSProperties;
  titleStyle: CSSProperties;
  titleClass: string;
} {
  const colorHex = pastelHex(color);
  const borderHex = pastelHex(appearance.borderColor) ?? colorHex;

  const sectionStyle: CSSProperties = {};
  let noBorder = false;
  if (appearance.border === "none") {
    noBorder = true;
  } else if (appearance.border === "full" && borderHex) {
    sectionStyle.borderColor = borderHex;
    sectionStyle.borderWidth = 1;
  } else if (appearance.border === "top" && borderHex) {
    sectionStyle.borderTopColor = borderHex;
    sectionStyle.borderTopWidth = 3;
  }

  const headerStyle: CSSProperties = {};
  // Cor de fundo escolhida à parte tem prioridade sobre a cor de acento —
  // permite fundo azul num painel com acento verde, por exemplo.
  const backgroundHex = pastelHex(appearance.backgroundColor) ?? colorHex;
  if (appearance.background === "tint" && backgroundHex) {
    headerStyle.background = `${backgroundHex}12`;
  }

  const titleHex = pastelHex(appearance.titleColor) ?? colorHex;
  return {
    sectionStyle,
    noBorder,
    headerStyle,
    titleStyle: titleHex ? { color: titleHex } : {},
    titleClass: `${titleSizeClass(appearance.titleSize)} ${weightClass(
      appearance.titleWeight,
    )}`,
  };
}

export function hasCustomPanelAppearance(appearance: PanelAppearance): boolean {
  return (
    appearance.background !== DEFAULT_PANEL_APPEARANCE.background ||
    appearance.backgroundColor !== DEFAULT_PANEL_APPEARANCE.backgroundColor ||
    appearance.border !== DEFAULT_PANEL_APPEARANCE.border ||
    appearance.borderColor !== DEFAULT_PANEL_APPEARANCE.borderColor ||
    appearance.titleColor !== DEFAULT_PANEL_APPEARANCE.titleColor ||
    appearance.titleSize !== DEFAULT_PANEL_APPEARANCE.titleSize ||
    appearance.titleWeight !== DEFAULT_PANEL_APPEARANCE.titleWeight
  );
}
