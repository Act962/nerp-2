import type { ErpConnectionKind } from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import type { SalesMode } from "./_schemas";

export type ErpConnectionHint = { kind: ErpConnectionKind } | null;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Vendido automático: soma de Sale COMPLETED por usuário criador dentro da
// janela do período. `periodEnd` chega como 00:00 do último dia (formato do
// parser da planilha), por isso a janela usa `lt periodEnd + 1 dia`. Vendas
// concluídas sem `completedAt` caem para `createdAt`.
export async function computeAchievedByUserId(
  organizationId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<Map<string, number>> {
  const endExclusive = new Date(periodEnd.getTime() + ONE_DAY_MS);

  const salesByCreator = await prisma.sale.groupBy({
    by: ["createdById"],
    where: {
      organizationId,
      status: "COMPLETED",
      createdById: { not: null },
      OR: [
        { completedAt: { gte: periodStart, lt: endExclusive } },
        {
          completedAt: null,
          createdAt: { gte: periodStart, lt: endExclusive },
        },
      ],
    },
    _sum: { total: true },
  });

  const achievedByUserId = new Map<string, number>();
  for (const group of salesByCreator) {
    if (group.createdById) {
      achievedByUserId.set(group.createdById, Number(group._sum.total ?? 0));
    }
  }
  return achievedByUserId;
}

export async function resolveUserIdByMemberId(
  organizationId: string,
  memberIds: string[],
): Promise<Map<string, string>> {
  if (memberIds.length === 0) return new Map();

  const members = await prisma.member.findMany({
    where: { id: { in: memberIds }, organizationId },
    select: { id: true, userId: true },
  });
  return new Map(members.map((member) => [member.id, member.userId]));
}

// Métricas de performance que só existem quando a origem é um ERP externo: a
// venda nativa não guarda custo, e sem custo não há margem.
export interface EntrySalesMetrics {
  revenue: number;
  cost: number;
  margin: number;
  marginPercent: number | null;
  orders: number;
  customers: number;
  averageTicket: number | null;
}

interface LookupEntry {
  externalCode: string;
  memberId: string | null;
}

export interface AchievedLookup {
  /** De onde saiu o vendido: espelho do ERP ou vendas nativas do NERP. */
  source: "ERP" | "NATIVE";
  /** Recorte ativo (INVOICED/PIPELINE); NATIVE ignora e devolve INVOICED. */
  salesMode: SalesMode;
  /** null = não resolvível automaticamente; o valor manual da entry prevalece. */
  achievedFor(entry: LookupEntry): number | null;
  metricsFor(entry: LookupEntry): EntrySalesMetrics | null;
  /**
   * Total vendido do período em CADA recorte, para o board mostrar o outro modo
   * como indicador secundário. NATIVE devolve o mesmo valor nos dois.
   */
  periodTotals(): { invoiced: number; pipeline: number };
}

function toMetrics(
  revenue: number,
  cost: number,
  orders: number,
  customers: number,
): EntrySalesMetrics {
  return {
    revenue,
    cost,
    margin: revenue - cost,
    marginPercent: revenue > 0 ? ((revenue - cost) / revenue) * 100 : null,
    orders,
    customers,
    averageTicket: orders > 0 ? revenue / orders : null,
  };
}

async function buildErpLookup(
  organizationId: string,
  periodStart: Date,
  periodEnd: Date,
  salesMode: SalesMode,
): Promise<AchievedLookup> {
  // O código do vendedor na planilha de metas é o mesmo código do ERP, então o
  // vínculo é direto — não depende de ninguém ter ligado a entry a um Member.
  const [facts, sellers] = await Promise.all([
    prisma.salesFactDaily.groupBy({
      by: ["sellerExternalCode"],
      where: {
        organizationId,
        date: { gte: periodStart, lte: periodEnd },
      },
      _sum: {
        revenue: true,
        cost: true,
        orders: true,
        customers: true,
        revenuePipeline: true,
        costPipeline: true,
        ordersPipeline: true,
        customersPipeline: true,
      },
    }),
    prisma.externalSeller.findMany({
      where: { organizationId },
      select: { externalCode: true },
    }),
  ]);

  const metricsByCode = new Map<string, EntrySalesMetrics>();
  let invoicedTotal = 0;
  let pipelineTotal = 0;

  for (const fact of facts) {
    const invoicedRevenue = Number(fact._sum.revenue ?? 0);
    const pipelineRevenue = Number(fact._sum.revenuePipeline ?? 0);
    invoicedTotal += invoicedRevenue;
    pipelineTotal += pipelineRevenue;

    // As métricas expostas seguem o recorte ativo — o board pede o modo que quer.
    const metrics =
      salesMode === "PIPELINE"
        ? toMetrics(
            pipelineRevenue,
            Number(fact._sum.costPipeline ?? 0),
            Number(fact._sum.ordersPipeline ?? 0),
            Number(fact._sum.customersPipeline ?? 0),
          )
        : toMetrics(
            invoicedRevenue,
            Number(fact._sum.cost ?? 0),
            Number(fact._sum.orders ?? 0),
            Number(fact._sum.customers ?? 0),
          );
    metricsByCode.set(fact.sellerExternalCode, metrics);
  }

  // Vendedor conhecido e sem venda no período vale zero. Código desconhecido
  // vale null, para não sobrescrever um valor digitado à mão.
  const knownCodes = new Set(sellers.map((seller) => seller.externalCode));

  return {
    source: "ERP",
    salesMode,
    achievedFor: (entry) => {
      const metrics = metricsByCode.get(entry.externalCode);
      if (metrics) return metrics.revenue;
      return knownCodes.has(entry.externalCode) ? 0 : null;
    },
    metricsFor: (entry) => metricsByCode.get(entry.externalCode) ?? null,
    periodTotals: () => ({ invoiced: invoicedTotal, pipeline: pipelineTotal }),
  };
}

async function buildNativeLookup(
  organizationId: string,
  periodStart: Date,
  periodEnd: Date,
  memberIds: string[],
): Promise<AchievedLookup> {
  const userIdByMemberId = await resolveUserIdByMemberId(
    organizationId,
    memberIds,
  );
  const achievedByUserId =
    memberIds.length > 0
      ? await computeAchievedByUserId(organizationId, periodStart, periodEnd)
      : new Map<string, number>();

  let total = 0;
  for (const value of achievedByUserId.values()) total += value;

  return {
    source: "NATIVE",
    salesMode: "INVOICED",
    achievedFor: (entry) => {
      if (!entry.memberId) return null;
      const userId = userIdByMemberId.get(entry.memberId);
      if (userId === undefined) return null;
      return achievedByUserId.get(userId) ?? 0;
    },
    metricsFor: () => null,
    // Venda nativa não tem pipeline; os dois modos valem o mesmo.
    periodTotals: () => ({ invoiced: total, pipeline: total }),
  };
}

/**
 * Resolve de onde vem o "vendido" da organização.
 *
 * Org com ERP externo casa a entry pelo código do vendedor; sem ERP, mantém o
 * caminho antigo (entry vinculada a um Member → vendas nativas). A escolha olha
 * só o `kind` da conexão: sync com erro segue lendo o espelho, porque cair para
 * as vendas nativas mostraria zero vendido sem avisar ninguém.
 */
export async function buildAchievedLookup(
  organizationId: string,
  periodStart: Date,
  periodEnd: Date,
  memberIds: string[],
  salesMode: SalesMode = "INVOICED",
  // Conexão já resolvida pelo chamador. `evolution` chama isto por período; sem
  // o hint, cada período refaria o mesmo `findUnique`. `undefined` = resolver
  // aqui; `null`/objeto = usar o que veio.
  knownConnection?: ErpConnectionHint,
): Promise<AchievedLookup> {
  const connection =
    knownConnection !== undefined
      ? knownConnection
      : await prisma.erpConnection.findUnique({
          where: { organizationId },
          select: { kind: true },
        });

  if (connection && connection.kind !== "NATIVE") {
    return buildErpLookup(organizationId, periodStart, periodEnd, salesMode);
  }
  return buildNativeLookup(organizationId, periodStart, periodEnd, memberIds);
}
