import prisma from "@/lib/db";
import {
  getErpMargin,
  getErpOrdersCount,
  getErpRevenueBySeller,
  getErpRevenueBySellerChart,
  getErpRevenueTrend,
} from "./_erp-aggregation";
import { getSalesByPiauiMunicipio, getSalesByState } from "./_geo-aggregation";
import {
  getAvgTicket,
  getLatestSales,
  getLowStockCount,
  getLowStockList,
  getProductsActive,
  getSalesToday,
  getSalesTodayByHour,
  getSalesTotal,
  getStockMovementsTrend,
} from "./_native-aggregation";
import {
  getOrgGoalVsAchieved,
  getTeamRankingTop,
  getTopTeamPercent,
} from "./_ranking-widgets";
import type { ResolveContext, WidgetValue } from "./_types";

export type WidgetCategory = "native" | "ranking" | "erp" | "manual" | "geo";
export type WidgetDisplayType = "STAT" | "CHART" | "LIST" | "MAP" | "TABLE";
export type WidgetChartKind = "LINE" | "BAR" | "DONUT";

export interface WidgetDefinition {
  key: string;
  category: WidgetCategory;
  label: string;
  description?: string;
  supportedDisplayTypes: WidgetDisplayType[];
  supportedChartKinds?: WidgetChartKind[];
  requiresErp?: boolean;
  defaultSize: { w: number; h: number };
  resolve: (ctx: ResolveContext) => Promise<WidgetValue>;
}

// Catálogo estático — não é tabela no banco de propósito, mesmo raciocínio de
// PAGE_PERMISSIONS em src/lib/permissions.ts: lista tipada em código, widget
// novo é PR novo, não linha de admin. Entradas "manual.*" não moram aqui —
// são geradas em runtime, uma por DashboardManualMetric da org (ver
// getManualWidgetDefinitions abaixo).
export const WIDGET_REGISTRY: Record<string, WidgetDefinition> = {
  "native.salesTotal": {
    key: "native.salesTotal",
    category: "native",
    label: "Total em vendas",
    supportedDisplayTypes: ["STAT"],
    defaultSize: { w: 3, h: 2 },
    resolve: getSalesTotal,
  },
  "native.salesToday": {
    key: "native.salesToday",
    category: "native",
    label: "Vendas hoje",
    supportedDisplayTypes: ["STAT"],
    defaultSize: { w: 3, h: 2 },
    resolve: getSalesToday,
  },
  "native.avgTicket": {
    key: "native.avgTicket",
    category: "native",
    label: "Ticket médio",
    supportedDisplayTypes: ["STAT"],
    defaultSize: { w: 3, h: 2 },
    resolve: getAvgTicket,
  },
  "native.productsActive": {
    key: "native.productsActive",
    category: "native",
    label: "Produtos ativos",
    supportedDisplayTypes: ["STAT"],
    defaultSize: { w: 3, h: 2 },
    resolve: getProductsActive,
  },
  "native.lowStockCount": {
    key: "native.lowStockCount",
    category: "native",
    label: "Estoque baixo (contagem)",
    supportedDisplayTypes: ["STAT"],
    defaultSize: { w: 3, h: 2 },
    resolve: getLowStockCount,
  },
  "native.lowStockList": {
    key: "native.lowStockList",
    category: "native",
    label: "Estoque baixo (lista)",
    supportedDisplayTypes: ["LIST"],
    defaultSize: { w: 4, h: 4 },
    resolve: getLowStockList,
  },
  "native.latestSales": {
    key: "native.latestSales",
    category: "native",
    label: "Últimas vendas",
    supportedDisplayTypes: ["LIST"],
    defaultSize: { w: 4, h: 4 },
    resolve: getLatestSales,
  },
  "native.stockMovementsTrend": {
    key: "native.stockMovementsTrend",
    category: "native",
    label: "Movimentações de estoque (14 dias)",
    supportedDisplayTypes: ["CHART"],
    supportedChartKinds: ["LINE", "BAR"],
    defaultSize: { w: 6, h: 4 },
    resolve: getStockMovementsTrend,
  },
  "ranking.teamRankingTop": {
    key: "ranking.teamRankingTop",
    category: "ranking",
    label: "Ranking de Equipes (top 10)",
    description: "Mesmo ranking da tela /ranking, resumido aqui.",
    supportedDisplayTypes: ["LIST"],
    // Maior que o padrão dos outros LIST — o dashboard renderiza este com o
    // pódio de verdade (mesmos componentes de /ranking), que sozinho já tem
    // 420-560px de altura própria (fixa, não encolhe). h:8 deixava a lista
    // de baixo cortada; com scroll interno sobra, mas o padrão precisa caber
    // sem precisar rolar de cara.
    defaultSize: { w: 6, h: 13 },
    resolve: getTeamRankingTop,
  },
  "ranking.topTeamPercent": {
    key: "ranking.topTeamPercent",
    category: "ranking",
    label: "% da equipe líder",
    supportedDisplayTypes: ["STAT"],
    defaultSize: { w: 3, h: 2 },
    resolve: getTopTeamPercent,
  },
  "ranking.orgGoalVsAchieved": {
    key: "ranking.orgGoalVsAchieved",
    category: "ranking",
    label: "Meta vs. Realizado (org)",
    supportedDisplayTypes: ["STAT"],
    defaultSize: { w: 3, h: 2 },
    resolve: getOrgGoalVsAchieved,
  },
  "erp.revenueTrend": {
    key: "erp.revenueTrend",
    category: "erp",
    label: "Receita (tendência do mês)",
    supportedDisplayTypes: ["CHART"],
    supportedChartKinds: ["LINE", "BAR"],
    requiresErp: true,
    defaultSize: { w: 6, h: 4 },
    resolve: getErpRevenueTrend,
  },
  "erp.margin": {
    key: "erp.margin",
    category: "erp",
    label: "Margem (tendência do mês)",
    supportedDisplayTypes: ["CHART"],
    supportedChartKinds: ["LINE"],
    requiresErp: true,
    defaultSize: { w: 6, h: 4 },
    resolve: getErpMargin,
  },
  "erp.ordersCount": {
    key: "erp.ordersCount",
    category: "erp",
    label: "Pedidos (mês)",
    supportedDisplayTypes: ["STAT"],
    requiresErp: true,
    defaultSize: { w: 3, h: 2 },
    resolve: getErpOrdersCount,
  },
  "erp.revenueBySeller": {
    key: "erp.revenueBySeller",
    category: "erp",
    label: "Receita por vendedor",
    supportedDisplayTypes: ["LIST"],
    requiresErp: true,
    defaultSize: { w: 4, h: 4 },
    resolve: getErpRevenueBySeller,
  },
  "erp.revenueBySellerChart": {
    key: "erp.revenueBySellerChart",
    category: "erp",
    label: "Receita por vendedor (gráfico)",
    description:
      "Mesmo dado de 'Receita por vendedor', em pizza/donut ou barra.",
    supportedDisplayTypes: ["CHART"],
    supportedChartKinds: ["DONUT", "BAR"],
    requiresErp: true,
    defaultSize: { w: 4, h: 4 },
    resolve: getErpRevenueBySellerChart,
  },
  "native.salesTodayByHour": {
    key: "native.salesTodayByHour",
    category: "native",
    label: "Vendas hoje (por hora)",
    supportedDisplayTypes: ["CHART"],
    supportedChartKinds: ["LINE", "BAR"],
    defaultSize: { w: 6, h: 4 },
    resolve: getSalesTodayByHour,
  },
  "geo.salesByState": {
    key: "geo.salesByState",
    category: "geo",
    label: "Mapa de vendas por estado",
    description: "Estado cadastrado do cliente vinculado à venda.",
    supportedDisplayTypes: ["MAP"],
    defaultSize: { w: 6, h: 6 },
    resolve: getSalesByState,
  },
  "geo.salesByPiauiMunicipio": {
    key: "geo.salesByPiauiMunicipio",
    category: "geo",
    label: "Mapa de vendas por município (PI)",
    description: "Município cadastrado do cliente vinculado à venda.",
    supportedDisplayTypes: ["MAP"],
    defaultSize: { w: 6, h: 6 },
    resolve: getSalesByPiauiMunicipio,
  },
};

export const MANUAL_KEY_PREFIX = "manual.";

export function manualMetricKey(id: string): string {
  return `${MANUAL_KEY_PREFIX}${id}`;
}

export function parseManualMetricId(dataSourceKey: string): string | null {
  return dataSourceKey.startsWith(MANUAL_KEY_PREFIX)
    ? dataSourceKey.slice(MANUAL_KEY_PREFIX.length)
    : null;
}

const UNIT_BY_METRIC_UNIT: Record<string, "currency" | "number" | "percent"> = {
  currency: "currency",
  number: "number",
  percent: "percent",
};

// Widgets manuais não ficam no WIDGET_REGISTRY estático — resolve direto
// contra DashboardManualMetric, e some do catálogo/board sozinho se a
// métrica for apagada (ver resolveWidgetValue: retorna null em vez de
// lançar, a UI mostra "fonte removida").
export async function resolveManualMetricValue(
  organizationId: string,
  metricId: string,
): Promise<WidgetValue | null> {
  const metric = await prisma.dashboardManualMetric.findFirst({
    where: { id: metricId, organizationId },
    select: { value: true, unit: true },
  });
  if (!metric) return null;
  return {
    kind: "STAT",
    value: Number(metric.value),
    unit: UNIT_BY_METRIC_UNIT[metric.unit] ?? "number",
  };
}

export async function isErpActive(organizationId: string): Promise<boolean> {
  const connection = await prisma.erpConnection.findUnique({
    where: { organizationId },
    select: { kind: true, status: true },
  });
  return (
    connection !== null &&
    connection.kind !== "NATIVE" &&
    connection.status !== "PAUSED"
  );
}
