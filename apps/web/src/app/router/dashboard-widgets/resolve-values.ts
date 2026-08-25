import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { resolveOracleWidgets } from "./_oracle-custom";
import { isOracleWidget } from "./_oracle-widget";
import {
  parseManualMetricId,
  resolveManualMetricValue,
  WIDGET_REGISTRY,
} from "./_registry";
import type { WidgetValue } from "./_types";

const resolveValuesInputSchema = z.object({
  widgetIds: z.array(z.string()).optional(),
});

// Calcula os valores atuais dos widgets do member. Resolve cada
// `dataSourceKey` DISTINTO uma única vez (Promise.all) e reaproveita o
// resultado pra todo widget que usa a mesma fonte — evita chamar
// buildSalesGoalRanking (ou qualquer resolver) uma vez por widget se o
// membro tiver, por exemplo, 3 widgets de ranking diferentes.
export const resolveDashboardWidgetValues = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Calcular os valores atuais dos meus widgets",
    tags: ["dashboard-widgets"],
  })
  .input(resolveValuesInputSchema)
  .handler(async ({ input, context, errors }) => {
    const member = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { id: true },
    });
    if (!member) {
      throw errors.NOT_FOUND({ message: "Membro não encontrado." });
    }

    const widgets = await prisma.dashboardWidget.findMany({
      where: {
        memberId: member.id,
        ...(input.widgetIds ? { id: { in: input.widgetIds } } : {}),
      },
      select: {
        id: true,
        dataSourceKey: true,
        displayType: true,
        options: true,
      },
    });

    // Widgets Oracle saem do caminho comum ANTES do dedup por chave: todos
    // compartilham `oracle.custom`, mas cada um tem uma consulta diferente no
    // `options` — deduplicar por dataSourceKey serviria o dado de um widget
    // para outro. Eles são identificados por fingerprint da config.
    const oracleWidgets = widgets.filter((widget) =>
      isOracleWidget(widget.dataSourceKey),
    );
    const oracleByWidgetId = await resolveOracleWidgets(
      context.org.id,
      oracleWidgets,
    );

    const uniqueKeys = [
      ...new Set(
        widgets
          .filter((widget) => !isOracleWidget(widget.dataSourceKey))
          .map((widget) => widget.dataSourceKey),
      ),
    ];
    const ctx = { organizationId: context.org.id };

    const resolvedByKey = new Map<string, WidgetValue | null>(
      await Promise.all(
        uniqueKeys.map(async (key): Promise<[string, WidgetValue | null]> => {
          const manualId = parseManualMetricId(key);
          if (manualId) {
            return [
              key,
              await resolveManualMetricValue(context.org.id, manualId),
            ];
          }
          const definition = WIDGET_REGISTRY[key];
          if (!definition) return [key, null];
          try {
            return [key, await definition.resolve(ctx)];
          } catch {
            return [key, null];
          }
        }),
      ),
    );

    return {
      values: widgets.map((widget) => {
        const oracle = oracleByWidgetId.get(widget.id);
        if (oracle) {
          return {
            widgetId: widget.id,
            value: oracle.value,
            progressPercent: undefined,
            error: oracle.error,
            computedAt: oracle.computedAt?.toISOString() ?? null,
          };
        }

        // null = fonte removida/indisponível — a UI mostra um placeholder em
        // vez de quebrar (métrica manual apagada, ERP desconectado depois do
        // widget criado, etc.).
        const value = resolvedByKey.get(widget.dataSourceKey) ?? null;
        // Meta (progressPercent) é sempre por instância — o cache acima é
        // por dataSourceKey e não pode saber da meta de UM widget específico.
        // Calculado aqui, depois do cache, nunca dentro de resolve(): ver
        // options.targetValue, nunca dentro do WidgetValue (que só descreve
        // "o que a fonte disse").
        const options = widget.options as { targetValue?: unknown } | null;
        const target =
          typeof options?.targetValue === "number" && options.targetValue > 0
            ? options.targetValue
            : null;
        const progressPercent =
          value?.kind === "STAT" && target !== null
            ? Math.min(100, (value.value / target) * 100)
            : undefined;
        return {
          widgetId: widget.id,
          value,
          progressPercent,
          error: null as string | null,
          computedAt: null as string | null,
        };
      }),
    };
  });
