import prisma from "@/lib/db";
import { MovementType, SaleStatus } from "@/generated/prisma/enums";
import type { ResolveContext, WidgetValue } from "./_types";

function startOfDay(daysAgo: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(daysAgo: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(23, 59, 59, 999);
  return date;
}

export async function getSalesTotal({
  organizationId,
}: ResolveContext): Promise<WidgetValue> {
  const result = await prisma.sale.aggregate({
    where: { organizationId, status: SaleStatus.CONFIRMED },
    _sum: { total: true },
  });
  return {
    kind: "STAT",
    value: Number(result._sum.total ?? 0),
    unit: "currency",
  };
}

export async function getSalesToday({
  organizationId,
}: ResolveContext): Promise<WidgetValue> {
  const [today, yesterday] = await Promise.all([
    prisma.sale.count({
      where: {
        organizationId,
        status: SaleStatus.CONFIRMED,
        createdAt: { gte: startOfDay(0), lte: endOfDay(0) },
      },
    }),
    prisma.sale.count({
      where: {
        organizationId,
        status: SaleStatus.CONFIRMED,
        createdAt: { gte: startOfDay(1), lte: endOfDay(1) },
      },
    }),
  ]);
  const delta = today - yesterday;
  return {
    kind: "STAT",
    value: today,
    unit: "number",
    deltaLabel: `${delta >= 0 ? "+" : ""}${delta} vs. ontem`,
  };
}

export async function getAvgTicket({
  organizationId,
}: ResolveContext): Promise<WidgetValue> {
  const result = await prisma.sale.aggregate({
    where: { organizationId, status: SaleStatus.CONFIRMED },
    _sum: { total: true },
    _count: true,
  });
  const total = Number(result._sum.total ?? 0);
  const count = result._count;
  return {
    kind: "STAT",
    value: count > 0 ? total / count : 0,
    unit: "currency",
  };
}

export async function getProductsActive({
  organizationId,
}: ResolveContext): Promise<WidgetValue> {
  const value = await prisma.product.count({
    where: { organizationId, isActive: true },
  });
  return { kind: "STAT", value, unit: "number" };
}

// Corrige o bug histórico do dashboard antigo: o card mostrava "-3 desde
// ontem" fixo no JSX em vez de usar essa diferença real (produtos que
// entraram em baixo estoque nas últimas 24h, não o total de baixo estoque).
export async function getLowStockCount({
  organizationId,
}: ResolveContext): Promise<WidgetValue> {
  const [total, newSinceYesterday] = await Promise.all([
    prisma.product.count({
      where: {
        organizationId,
        isActive: true,
        trackStock: true,
        currentStock: { lte: prisma.product.fields.minStock },
      },
    }),
    prisma.product.count({
      where: {
        organizationId,
        isActive: true,
        trackStock: true,
        currentStock: { lte: prisma.product.fields.minStock },
        createdAt: { gte: startOfDay(1), lte: endOfDay(1) },
      },
    }),
  ]);
  return {
    kind: "STAT",
    value: total,
    unit: "number",
    deltaLabel:
      newSinceYesterday > 0
        ? `+${newSinceYesterday} desde ontem`
        : "sem novidade desde ontem",
  };
}

export async function getLowStockList({
  organizationId,
}: ResolveContext): Promise<WidgetValue> {
  const products = await prisma.product.findMany({
    where: {
      organizationId,
      isActive: true,
      trackStock: true,
      currentStock: { lte: prisma.product.fields.minStock },
    },
    select: { id: true, name: true, sku: true, currentStock: true },
    orderBy: { currentStock: "asc" },
    take: 10,
  });
  return {
    kind: "LIST",
    items: products.map((product) => ({
      id: product.id,
      label: product.name,
      value: product.currentStock.toNumber(),
      unit: "number" as const,
      meta: product.sku ?? undefined,
    })),
  };
}

export async function getLatestSales({
  organizationId,
}: ResolveContext): Promise<WidgetValue> {
  const movements = await prisma.stockMovement.findMany({
    where: {
      organizationId,
      type: MovementType.VENDA,
      sale: { status: SaleStatus.CONFIRMED, customerId: { not: null } },
    },
    select: {
      id: true,
      createdAt: true,
      sale: { select: { total: true, customer: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  return {
    kind: "LIST",
    items: movements.flatMap((movement) => {
      if (!movement.sale?.customer) return [];
      return [
        {
          id: movement.id,
          label: movement.sale.customer.name,
          value: movement.sale.total.toNumber(),
          unit: "currency" as const,
        },
      ];
    }),
  };
}

// Tendência de 14 dias — sem groupBy-por-dia nativo no Postgres via Prisma
// (groupBy só agrupa por igualdade de coluna, não por truncamento de data),
// então busca a janela inteira e agrupa em memória. Volume de 14 dias é
// pequeno o bastante pra não precisar de SQL bruto aqui.
export async function getStockMovementsTrend({
  organizationId,
}: ResolveContext): Promise<WidgetValue> {
  const start = startOfDay(13);
  const movements = await prisma.stockMovement.findMany({
    where: { organizationId, createdAt: { gte: start } },
    select: { createdAt: true },
  });

  const byDay = new Map<string, number>();
  for (let i = 13; i >= 0; i--) {
    byDay.set(startOfDay(i).toISOString().slice(0, 10), 0);
  }
  for (const movement of movements) {
    const key = movement.createdAt.toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }

  return {
    kind: "CHART",
    series: [...byDay.entries()].map(([label, value]) => ({ label, value })),
  };
}

// Horário comercial (6h-22h) — fora disso o volume normalmente é zero e só
// polui o eixo do gráfico. Mesmo padrão de bucket em memória de
// getStockMovementsTrend (sem groupBy-por-hora nativo).
const BUSINESS_HOUR_START = 6;
const BUSINESS_HOUR_END = 22;

export async function getSalesTodayByHour({
  organizationId,
}: ResolveContext): Promise<WidgetValue> {
  const sales = await prisma.sale.findMany({
    where: {
      organizationId,
      status: SaleStatus.CONFIRMED,
      createdAt: { gte: startOfDay(0), lte: endOfDay(0) },
    },
    select: { createdAt: true, total: true },
  });

  const byHour = new Map<number, number>();
  for (let hour = BUSINESS_HOUR_START; hour <= BUSINESS_HOUR_END; hour++) {
    byHour.set(hour, 0);
  }
  for (const sale of sales) {
    const hour = sale.createdAt.getHours();
    if (hour < BUSINESS_HOUR_START || hour > BUSINESS_HOUR_END) continue;
    byHour.set(hour, (byHour.get(hour) ?? 0) + sale.total.toNumber());
  }

  return {
    kind: "CHART",
    series: [...byHour.entries()].map(([hour, value]) => ({
      label: `${String(hour).padStart(2, "0")}h`,
      value,
    })),
  };
}
