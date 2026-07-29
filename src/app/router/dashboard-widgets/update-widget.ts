import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { Prisma } from "@/generated/prisma/client";
import { PASTEL_COLORS } from "@/features/dashboard-widgets/lib/pastel-colors";
import { WIDGET_ICONS } from "@/features/dashboard-widgets/lib/widget-icons";
import prisma from "@/lib/db";
import { isOracleWidget, validateOracleWidget } from "./_oracle-widget";
import { WIDGET_REGISTRY } from "./_registry";

interface GridItem {
  x: number;
  y: number;
  w: number;
  h: number;
}

const PASTEL_KEYS = PASTEL_COLORS.map((color) => color.key);
const ICON_KEYS = WIDGET_ICONS.map((icon) => icon.key);

const updateWidgetInputSchema = z.object({
  widgetId: z.string(),
  // Vazio = volta ao rótulo padrão da fonte.
  title: z.string().max(60).nullable().optional(),
  // Move o widget para dentro de outro card, ou de volta para a grade (null).
  parentId: z.string().nullable().optional(),
  displayType: z.enum(["STAT", "CHART", "LIST", "MAP", "TABLE"]).optional(),
  chartKind: z.enum(["LINE", "BAR", "DONUT"]).nullable().optional(),
  color: z
    .enum(PASTEL_KEYS as [string, ...string[]])
    .nullable()
    .optional(),
  icon: z
    .enum(ICON_KEYS as [string, ...string[]])
    .nullable()
    .optional(),
  options: z.record(z.string(), z.unknown()).nullable().optional(),
});

// Muda tipo de exibição/gráfico/opções de um widget já existente. Layout
// (posição/tamanho) tem endpoint próprio (saveLayout) — cadência diferente
// (debounced a cada arraste/resize) da de um form explícito.
export const updateDashboardWidget = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Atualizar tipo de exibição/opções de um widget",
    tags: ["dashboard-widgets"],
  })
  .input(updateWidgetInputSchema)
  .handler(async ({ input, context, errors }) => {
    const member = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { id: true },
    });
    if (!member) {
      throw errors.NOT_FOUND({ message: "Membro não encontrado." });
    }

    const widget = await prisma.dashboardWidget.findFirst({
      where: { id: input.widgetId, memberId: member.id },
    });
    if (!widget) {
      throw errors.NOT_FOUND({ message: "Widget não encontrado." });
    }

    if (isOracleWidget(widget.dataSourceKey)) {
      // Config e displayType são validados JUNTOS: mudar só um dos dois pode
      // quebrar o par (ex.: virar TABLE numa consulta de medida única).
      const options =
        input.options === undefined
          ? (widget.options as Record<string, unknown> | null)
          : input.options;
      await validateOracleWidget({
        organizationId: context.org.id,
        userId: context.user.id,
        options,
        displayType: input.displayType ?? widget.displayType,
      });
    } else if (input.displayType) {
      const definition = WIDGET_REGISTRY[widget.dataSourceKey];
      // Métrica manual só suporta STAT — sem checagem de registry pra ela.
      const supported = definition?.supportedDisplayTypes ?? ["STAT"];
      if (!supported.includes(input.displayType)) {
        throw errors.BAD_REQUEST({
          message: "Esse tipo de exibição não é suportado por esta fonte.",
        });
      }
    }

    // Mover de/para dentro de outro card. Três coisas podem quebrar a regra de
    // "um nível só", e as três são checadas aqui porque o client pode mentir.
    let layoutOnMove: Prisma.InputJsonValue | undefined;
    if (input.parentId !== undefined && input.parentId !== widget.parentId) {
      if (input.parentId === widget.id) {
        throw errors.BAD_REQUEST({
          message: "Um widget não pode ser colocado dentro de si mesmo.",
        });
      }
      if (input.parentId) {
        const [parent, ownChildren] = await Promise.all([
          prisma.dashboardWidget.findFirst({
            where: { id: input.parentId, memberId: member.id },
            select: { parentId: true },
          }),
          prisma.dashboardWidget.count({ where: { parentId: widget.id } }),
        ]);
        if (!parent) {
          throw errors.NOT_FOUND({
            message: "Widget de destino não encontrado.",
          });
        }
        if (parent.parentId) {
          throw errors.BAD_REQUEST({
            message:
              "Só é possível aninhar um nível: o destino já está dentro de outro widget.",
          });
        }
        // Mover um card QUE TEM filhos para dentro de outro empurraria os
        // filhos para o segundo nível.
        if (ownChildren > 0) {
          throw errors.BAD_REQUEST({
            message:
              "Este widget tem desdobramentos. Remova-os antes de colocá-lo dentro de outro.",
          });
        }
      } else {
        // Voltando para a grade: o widget não tinha posição enquanto era
        // filho, então entra embaixo de tudo em vez de sobrepor alguém.
        const roots = await prisma.dashboardWidget.findMany({
          where: { memberId: member.id, parentId: null },
          select: { layout: true },
        });
        let maxBottom = 0;
        for (const root of roots) {
          const item = (root.layout as Record<string, GridItem> | null)?.lg;
          if (item) maxBottom = Math.max(maxBottom, item.y + item.h);
        }
        const position = { x: 0, y: maxBottom, w: 4, h: 3 };
        layoutOnMove = { lg: position, md: position, sm: position };
      }
    }

    await prisma.dashboardWidget.update({
      where: { id: widget.id },
      data: {
        title:
          input.title === undefined ? undefined : input.title?.trim() || null,
        displayType: input.displayType,
        chartKind:
          input.displayType === "CHART"
            ? (input.chartKind ?? widget.chartKind)
            : input.displayType
              ? null
              : undefined,
        color: input.color,
        icon: input.icon,
        parentId: input.parentId,
        layout: layoutOnMove,
        options:
          input.options === undefined
            ? undefined
            : input.options === null
              ? Prisma.DbNull
              : (input.options as Prisma.InputJsonValue),
      },
    });

    return { id: widget.id };
  });
