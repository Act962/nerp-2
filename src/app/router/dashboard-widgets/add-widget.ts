import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import type { Prisma } from "@/generated/prisma/client";
import {
  HEX_COLOR_RE,
  PASTEL_COLORS,
} from "@/features/dashboard-widgets/lib/pastel-colors";
import { WIDGET_ICONS } from "@/features/dashboard-widgets/lib/widget-icons";
import prisma from "@/lib/db";
import { isOracleWidget, validateOracleWidget } from "./_oracle-widget";
import {
  isErpActive,
  parseManualMetricId,
  type WidgetChartKind,
  type WidgetDisplayType,
  WIDGET_REGISTRY,
} from "./_registry";

const gridItemSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  w: z.number().int(),
  h: z.number().int(),
});

const BREAKPOINTS_WITH_LAYOUT = ["lg", "md", "sm"] as const;
const PASTEL_KEYS = PASTEL_COLORS.map((color) => color.key);
const ICON_KEYS = WIDGET_ICONS.map((icon) => icon.key);

const addWidgetInputSchema = z.object({
  dataSourceKey: z.string().min(1),
  // Vazio = mantém o rótulo padrão da fonte.
  title: z.string().max(60).nullable().optional(),
  // Preenchido = o widget nasce DENTRO de outro card, não na grade.
  parentId: z.string().nullable().optional(),
  displayType: z.enum(["STAT", "CHART", "LIST", "MAP", "TABLE"]),
  chartKind: z.enum(["LINE", "BAR", "DONUT"]).nullable().optional(),
  // Chave da paleta OU hex `#rrggbb` livre (conta-gotas). Union em vez de
  // string livre porque tudo que não bater aqui pode chegar a inline style —
  // é o que evita `red`/`javascript:`/whatever virar CSS injection.
  color: z
    .union([
      z.enum(PASTEL_KEYS as [string, ...string[]]),
      z.string().regex(HEX_COLOR_RE),
    ])
    .nullable()
    .optional(),
  // Mesma validação enum-only de `color`, nunca string livre.
  icon: z
    .enum(ICON_KEYS as [string, ...string[]])
    .nullable()
    .optional(),
  options: z.record(z.string(), z.unknown()).nullable().optional(),
});

interface WidgetAvailability {
  supportedDisplayTypes: WidgetDisplayType[];
  supportedChartKinds: WidgetChartKind[];
  requiresErp: boolean;
  defaultSize: { w: number; h: number };
}

// Resolve a definição da entrada — estática (registry) ou manual
// (DashboardManualMetric da própria org). Nunca confia no client sobre
// requiresErp/supportedDisplayTypes: revalida tudo aqui.
async function resolveDefinition(
  organizationId: string,
  dataSourceKey: string,
): Promise<WidgetAvailability | null> {
  // Consulta customizada do Oracle: a "definição" sai da própria config do
  // widget (validada em validateOracleWidget), não do registry estático.
  if (isOracleWidget(dataSourceKey)) {
    return {
      supportedDisplayTypes: ["STAT", "CHART", "LIST", "TABLE"],
      supportedChartKinds: ["LINE", "BAR", "DONUT"],
      requiresErp: true,
      defaultSize: { w: 6, h: 4 },
    };
  }

  const manualId = parseManualMetricId(dataSourceKey);
  if (manualId) {
    const metric = await prisma.dashboardManualMetric.findFirst({
      where: { id: manualId, organizationId },
      select: { id: true },
    });
    if (!metric) return null;
    return {
      supportedDisplayTypes: ["STAT"],
      supportedChartKinds: [],
      requiresErp: false,
      defaultSize: { w: 3, h: 2 },
    };
  }
  const definition = WIDGET_REGISTRY[dataSourceKey];
  if (!definition) return null;
  return {
    supportedDisplayTypes: definition.supportedDisplayTypes,
    supportedChartKinds: definition.supportedChartKinds ?? [],
    requiresErp: definition.requiresErp ?? false,
    defaultSize: definition.defaultSize,
  };
}

export const addDashboardWidget = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Adicionar um widget ao meu dashboard",
    tags: ["dashboard-widgets"],
  })
  .input(addWidgetInputSchema)
  .handler(async ({ input, context, errors }) => {
    const member = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { id: true },
    });
    if (!member) {
      throw errors.NOT_FOUND({ message: "Membro não encontrado." });
    }

    const definition = await resolveDefinition(
      context.org.id,
      input.dataSourceKey,
    );
    if (!definition) {
      throw errors.BAD_REQUEST({ message: "Fonte de dado desconhecida." });
    }
    if (!definition.supportedDisplayTypes.includes(input.displayType)) {
      throw errors.BAD_REQUEST({
        message: "Esse tipo de exibição não é suportado por esta fonte.",
      });
    }
    if (
      input.displayType === "CHART" &&
      input.chartKind &&
      !definition.supportedChartKinds?.includes(input.chartKind)
    ) {
      throw errors.BAD_REQUEST({
        message: "Esse tipo de gráfico não é suportado por esta fonte.",
      });
    }
    if (definition.requiresErp && !(await isErpActive(context.org.id))) {
      throw errors.BAD_REQUEST({
        message: "Esta organização não tem uma conexão de ERP ativa.",
      });
    }
    // Gate de admin + pré-voo da consulta. Depois das checagens genéricas para
    // a mensagem de erro mais específica prevalecer.
    if (isOracleWidget(input.dataSourceKey)) {
      await validateOracleWidget({
        organizationId: context.org.id,
        userId: context.user.id,
        options: input.options,
        displayType: input.displayType,
      });
    }

    // Widget aninhado: valida o pai e impede um segundo nível. Card com árvore
    // de filhos vira ilegível e não teria como caber no espaço da grade.
    if (input.parentId) {
      const parent = await prisma.dashboardWidget.findFirst({
        where: { id: input.parentId, memberId: member.id },
        select: { parentId: true },
      });
      if (!parent) {
        throw errors.NOT_FOUND({
          message: "Widget de destino não encontrado.",
        });
      }
      if (parent.parentId) {
        throw errors.BAD_REQUEST({
          message:
            "Só é possível aninhar um nível: este widget já está dentro de outro.",
        });
      }
    }

    const existing = await prisma.dashboardWidget.findMany({
      where: { memberId: member.id, parentId: null },
      select: { layout: true, sortOrder: true },
    });

    const layout: Record<
      string,
      { x: number; y: number; w: number; h: number }
    > = {};
    for (const breakpoint of BREAKPOINTS_WITH_LAYOUT) {
      let maxBottom = 0;
      for (const widget of existing) {
        const raw = widget.layout as Record<string, unknown> | null;
        const parsed = gridItemSchema.safeParse(raw?.[breakpoint]);
        if (parsed.success) {
          maxBottom = Math.max(maxBottom, parsed.data.y + parsed.data.h);
        }
      }
      layout[breakpoint] = {
        x: 0,
        y: maxBottom,
        w: definition.defaultSize.w,
        h: definition.defaultSize.h,
      };
    }

    const maxSortOrder = existing.reduce(
      (max, widget) => Math.max(max, widget.sortOrder),
      -1,
    );

    const widget = await prisma.dashboardWidget.create({
      data: {
        memberId: member.id,
        dataSourceKey: input.dataSourceKey,
        title: input.title?.trim() || null,
        parentId: input.parentId ?? null,
        displayType: input.displayType,
        chartKind:
          input.displayType === "CHART" ? (input.chartKind ?? null) : null,
        color: input.color ?? null,
        icon: input.icon ?? null,
        options: input.options
          ? (input.options as Prisma.InputJsonValue)
          : undefined,
        layout,
        sortOrder: maxSortOrder + 1,
      },
    });

    return { id: widget.id };
  });
