import prisma from "@/lib/db";
import { SaleStatus } from "@/generated/prisma/enums";
import type { ResolveContext, WidgetValue } from "./_types";

// "Região" da venda = endereço cadastrado do Cliente vinculado, não o local
// físico da venda (Sale não guarda localização própria). Vendas sem cliente
// ou sem estado/cidade preenchido ficam de fora da soma, mesmo padrão já
// usado em getLatestSales (que já ignora vendas sem cliente).
async function loadSalesWithCustomerLocation(organizationId: string) {
  return prisma.sale.findMany({
    where: {
      organizationId,
      status: SaleStatus.CONFIRMED,
      customerId: { not: null },
    },
    select: {
      total: true,
      customer: { select: { state: true, city: true } },
    },
  });
}

export async function getSalesByState({
  organizationId,
}: ResolveContext): Promise<WidgetValue> {
  const sales = await loadSalesWithCustomerLocation(organizationId);

  const byState = new Map<string, number>();
  for (const sale of sales) {
    const state = sale.customer?.state?.trim().toUpperCase();
    if (!state) continue;
    byState.set(state, (byState.get(state) ?? 0) + sale.total.toNumber());
  }

  return {
    kind: "MAP",
    scope: "state",
    regions: [...byState.entries()].map(([id, value]) => ({
      id,
      label: id,
      value,
    })),
  };
}

export async function getSalesByPiauiMunicipio({
  organizationId,
}: ResolveContext): Promise<WidgetValue> {
  const sales = await loadSalesWithCustomerLocation(organizationId);

  const byCity = new Map<string, number>();
  for (const sale of sales) {
    const state = sale.customer?.state?.trim().toUpperCase();
    const city = sale.customer?.city?.trim();
    if (state !== "PI" || !city) continue;
    byCity.set(city, (byCity.get(city) ?? 0) + sale.total.toNumber());
  }

  return {
    kind: "MAP",
    scope: "piaui-municipio",
    regions: [...byCity.entries()].map(([id, value]) => ({
      id,
      label: id,
      value,
    })),
  };
}
