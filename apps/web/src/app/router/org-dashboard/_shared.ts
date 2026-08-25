import "server-only";

import { z } from "zod";
import {
  HEX_COLOR_RE,
  PASTEL_COLORS,
} from "@/features/dashboard-widgets/lib/pastel-colors";
import { WIDGET_ICONS } from "@/features/dashboard-widgets/lib/widget-icons";

// Schemas compartilhados entre os endpoints do OrgDashboard. Mantém a mesma
// aparência que `add-widget.ts` do dashboard pessoal — cor sempre da paleta
// OU hex, ícone sempre da lista curada, options JSON aberto (o resolver por
// dataSourceKey é quem valida `oracle`/`alert`/`appearance`).

export const PASTEL_KEYS = PASTEL_COLORS.map((color) => color.key) as [
  string,
  ...string[],
];
export const ICON_KEYS = WIDGET_ICONS.map((icon) => icon.key) as [
  string,
  ...string[],
];

export const widgetColorSchema = z
  .union([z.enum(PASTEL_KEYS), z.string().regex(HEX_COLOR_RE)])
  .nullable()
  .optional();

export const iconSchema = z.enum(ICON_KEYS).nullable().optional();

export const gridItemSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  w: z.number().int(),
  h: z.number().int(),
});

export const BREAKPOINTS_WITH_LAYOUT = ["lg", "md", "sm"] as const;

export const layoutSchema = z.record(
  z.enum(BREAKPOINTS_WITH_LAYOUT),
  gridItemSchema,
);

export const displayTypeSchema = z.enum([
  "STAT",
  "CHART",
  "LIST",
  "MAP",
  "TABLE",
]);
export const chartKindSchema = z.enum(["LINE", "BAR", "DONUT"]);
