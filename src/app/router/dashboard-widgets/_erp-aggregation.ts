import prisma from "@/lib/db";
import type { ResolveContext, WidgetValue } from "./_types";

// Mesma janela pros três widgets erp.* — mês corrente, igual ao período
// padrão do ranking. Modelado em buildErpLookup de
// src/app/router/ranking/_sales-aggregation.ts (mesmo groupBy sobre
// SalesFactDaily), mas aqui não precisa casar por vendedor/entry — só soma.
function currentMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999),
  );
  return { start, end };
}

export async function getErpRevenueTrend({
  organizationId,
}: ResolveContext): Promise<WidgetValue> {
  const { start, end } = currentMonthRange();
  const facts = await prisma.salesFactDaily.groupBy({
    by: ["date"],
    where: { organizationId, date: { gte: start, lte: end } },
    _sum: { revenue: true },
    orderBy: { date: "asc" },
  });
  return {
    kind: "CHART",
    series: facts.map((fact) => ({
      label: fact.date.toISOString().slice(0, 10),
      value: Number(fact._sum.revenue ?? 0),
    })),
  };
}

export async function getErpMargin({
  organizationId,
}: ResolveContext): Promise<WidgetValue> {
  const { start, end } = currentMonthRange();
  const facts = await prisma.salesFactDaily.groupBy({
    by: ["date"],
    where: { organizationId, date: { gte: start, lte: end } },
    _sum: { revenue: true, cost: true },
    orderBy: { date: "asc" },
  });
  return {
    kind: "CHART",
    series: facts.map((fact) => ({
      label: fact.date.toISOString().slice(0, 10),
      value: Number(fact._sum.revenue ?? 0) - Number(fact._sum.cost ?? 0),
    })),
  };
}

export async function getErpOrdersCount({
  organizationId,
}: ResolveContext): Promise<WidgetValue> {
  const { start, end } = currentMonthRange();
  const result = await prisma.salesFactDaily.aggregate({
    where: { organizationId, date: { gte: start, lte: end } },
    _sum: { orders: true },
  });
  return { kind: "STAT", value: result._sum.orders ?? 0, unit: "number" };
}

async function loadRevenueBySeller(organizationId: string) {
  const { start, end } = currentMonthRange();
  const [bySeller, sellers] = await Promise.all([
    prisma.salesFactDaily.groupBy({
      by: ["sellerExternalCode"],
      where: { organizationId, date: { gte: start, lte: end } },
      _sum: { revenue: true },
      orderBy: { _sum: { revenue: "desc" } },
      take: 10,
    }),
    prisma.externalSeller.findMany({
      where: { organizationId },
      select: { externalCode: true, name: true },
    }),
  ]);
  const nameByCode = new Map(
    sellers.map((seller) => [seller.externalCode, seller.name]),
  );
  return bySeller.map((row) => ({
    id: row.sellerExternalCode,
    label: nameByCode.get(row.sellerExternalCode) ?? row.sellerExternalCode,
    value: Number(row._sum.revenue ?? 0),
  }));
}

export async function getErpRevenueBySeller({
  organizationId,
}: ResolveContext): Promise<WidgetValue> {
  const rows = await loadRevenueBySeller(organizationId);
  return {
    kind: "LIST",
    items: rows.map((row, index) => ({
      ...row,
      unit: "currency" as const,
      rank: index + 1,
    })),
  };
}

// Mesma consulta de getErpRevenueBySeller, mas em formato CHART — alimenta a
// opção de gráfico donut/barra (chart-widget.tsx já sabe renderizar DONUT,
// só faltava uma fonte que devolvesse `series`). resolve() nunca sabe qual
// displayType o widget escolheu, então precisa de uma key própria em vez de
// tentar ser polimórfico sobre a mesma "erp.revenueBySeller".
export async function getErpRevenueBySellerChart({
  organizationId,
}: ResolveContext): Promise<WidgetValue> {
  const rows = await loadRevenueBySeller(organizationId);
  return {
    kind: "CHART",
    series: rows.map((row) => ({ label: row.label, value: row.value })),
  };
}
