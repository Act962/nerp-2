import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { ORACLE_CUSTOM_KEY } from "@/features/dashboard-widgets/lib/oracle-query-config";
import prisma from "@/lib/db";
import { isOrgAdmin } from "@/lib/org-access";
import { isErpActive, manualMetricKey, WIDGET_REGISTRY } from "./_registry";

// Metadados de tudo que pode virar widget — sem valores resolvidos (isso é
// dashboardWidgets.resolveValues). Qualquer membro pode ver o catálogo, não
// só quem pode criar métrica manual.
export const listDashboardWidgetCatalog = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Catálogo de widgets disponíveis pro dashboard",
    tags: ["dashboard-widgets"],
  })
  .input(z.object({}))
  .handler(async ({ context }) => {
    const [erpActive, manualMetrics] = await Promise.all([
      isErpActive(context.org.id),
      prisma.dashboardManualMetric.findMany({
        where: { organizationId: context.org.id },
        select: { id: true, label: true },
        orderBy: { label: "asc" },
      }),
    ]);

    const staticEntries = Object.values(WIDGET_REGISTRY).map((definition) => ({
      key: definition.key,
      category: definition.category,
      label: definition.label,
      description: definition.description ?? null,
      supportedDisplayTypes: definition.supportedDisplayTypes,
      supportedChartKinds: definition.supportedChartKinds ?? [],
      requiresErp: definition.requiresErp ?? false,
      available: definition.requiresErp ? erpActive : true,
      defaultSize: definition.defaultSize,
    }));

    // Consulta customizada do Oracle: uma entrada só, cuja configuração mora
    // no widget. Só aparece para quem pode configurar (admin) e quando existe
    // conexão Winthor ativa — senão seria um card que nunca funciona.
    const connection = await prisma.erpConnection.findUnique({
      where: { organizationId: context.org.id },
      select: { kind: true },
    });
    const canUseOracle =
      erpActive &&
      connection?.kind === "WINTHOR_ORACLE" &&
      (await isOrgAdmin(context.org.id, context.user.id));

    const oracleEntries = canUseOracle
      ? [
          {
            key: ORACLE_CUSTOM_KEY,
            category: "oracle" as const,
            label: "Consulta personalizada",
            description:
              "Escolha tabela, medidas, período e filtros do ERP do cliente.",
            supportedDisplayTypes: ["STAT", "CHART", "LIST", "TABLE"] as const,
            supportedChartKinds: ["LINE", "BAR", "DONUT"] as const,
            requiresErp: true,
            available: true,
            defaultSize: { w: 6, h: 4 },
          },
        ]
      : [];

    const manualEntries = manualMetrics.map((metric) => ({
      key: manualMetricKey(metric.id),
      category: "manual" as const,
      label: metric.label,
      description: null,
      supportedDisplayTypes: ["STAT"] as const,
      supportedChartKinds: [],
      requiresErp: false,
      available: true,
      defaultSize: { w: 3, h: 2 },
    }));

    return { widgets: [...staticEntries, ...oracleEntries, ...manualEntries] };
  });
