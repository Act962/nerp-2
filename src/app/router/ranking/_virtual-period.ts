import prisma from "@/lib/db";
import type { ALL_PERIOD_TYPES, SalesMode } from "./_schemas";

type SalesGoalPeriodType = (typeof ALL_PERIOD_TYPES)[number];

// Período virtual: o seletor de período do board oferece sete janelas, mas a
// planilha de metas só cadastra as que o gestor importou — na prática, o mês.
// Escolher "Diário" ou "Trimestral" caía num board vazio mesmo com venda
// sincronizada, porque não existia `SalesGoalPeriod` daquele tipo.
//
// Como `SalesFactDaily` é grão de DIA, qualquer janela é derivável. Este módulo
// monta um período na memória a partir dos fatos, sem persistir nada: período
// cadastrado continua tendo prioridade, e no dia em que a planilha trouxer metas
// para aquele tipo, ela assume o lugar.
//
// Sem meta, `goalAmount` é 0 — a mesma convenção do bootstrap. O board já sabe
// mostrar "Sem meta definida" e ordenar por valor vendido nesse caso.

const MONTHS_PT = [
  "JANEIRO",
  "FEVEREIRO",
  "MARÇO",
  "ABRIL",
  "MAIO",
  "JUNHO",
  "JULHO",
  "AGOSTO",
  "SETEMBRO",
  "OUTUBRO",
  "NOVEMBRO",
  "DEZEMBRO",
];

function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

function formatDay(date: Date): string {
  return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
}

export interface PeriodBounds {
  periodStart: Date;
  /** Inclusivo, 00:00 do último dia — mesma convenção do parser da planilha. */
  periodEnd: Date;
  label: string;
}

export function resolvePeriodBounds(
  periodType: SalesGoalPeriodType,
  reference: Date = new Date(),
): PeriodBounds {
  const year = reference.getUTCFullYear();
  const month = reference.getUTCMonth();
  const day = reference.getUTCDate();

  switch (periodType) {
    case "DAILY": {
      const start = utc(year, month, day);
      return { periodStart: start, periodEnd: start, label: formatDay(start) };
    }
    case "WEEKLY": {
      // Semana começa na segunda: getUTCDay() devolve 0 para domingo.
      const offset = (reference.getUTCDay() + 6) % 7;
      const start = utc(year, month, day - offset);
      const end = utc(year, month, day - offset + 6);
      return {
        periodStart: start,
        periodEnd: end,
        label: `SEMANA DE ${formatDay(start)}`,
      };
    }
    case "MONTHLY": {
      return {
        periodStart: utc(year, month, 1),
        periodEnd: utc(year, month + 1, 0),
        label: `${MONTHS_PT[month]}/${year}`,
      };
    }
    case "BIMONTHLY": {
      const startMonth = month - (month % 2);
      return {
        periodStart: utc(year, startMonth, 1),
        periodEnd: utc(year, startMonth + 2, 0),
        label: `${MONTHS_PT[startMonth]}-${MONTHS_PT[startMonth + 1]}/${year}`,
      };
    }
    case "QUARTERLY": {
      const startMonth = month - (month % 3);
      return {
        periodStart: utc(year, startMonth, 1),
        periodEnd: utc(year, startMonth + 3, 0),
        label: `${startMonth / 3 + 1}º TRIMESTRE/${year}`,
      };
    }
    case "SEMIANNUAL": {
      const startMonth = month < 6 ? 0 : 6;
      return {
        periodStart: utc(year, startMonth, 1),
        periodEnd: utc(year, startMonth + 6, 0),
        label: `${startMonth === 0 ? 1 : 2}º SEMESTRE/${year}`,
      };
    }
    case "ANNUAL": {
      return {
        periodStart: utc(year, 0, 1),
        periodEnd: utc(year, 11, 31),
        label: String(year),
      };
    }
  }
}

/**
 * Monta o período a partir do espelho do ERP, quando não há um cadastrado.
 *
 * Devolve `null` quando a organização não tem ERP externo ou não houve venda na
 * janela — board vazio honesto é melhor que uma lista de zeros.
 */
export async function buildVirtualPeriodFromErp(
  organizationId: string,
  periodType: SalesGoalPeriodType,
  reference?: Date,
  salesMode: SalesMode = "INVOICED",
) {
  const connection = await prisma.erpConnection.findUnique({
    where: { organizationId },
    select: { kind: true },
  });
  if (!connection || connection.kind === "NATIVE") return null;

  const { periodStart, periodEnd, label } = resolvePeriodBounds(
    periodType,
    reference,
  );

  const isPipeline = salesMode === "PIPELINE";

  const [facts, coverage] = await Promise.all([
    prisma.salesFactDaily.groupBy({
      by: ["sellerExternalCode"],
      where: { organizationId, date: { gte: periodStart, lte: periodEnd } },
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
    // Até onde o espelho realmente vai. O sync guarda uma janela móvel, então
    // uma janela longa (Anual, Semestral) pode começar antes do primeiro dia
    // sincronizado — e o total pareceria o ano inteiro sendo só um pedaço.
    prisma.salesFactDaily.aggregate({
      where: { organizationId },
      _min: { date: true },
    }),
  ]);
  if (facts.length === 0) return null;

  const coverageStart = coverage._min.date;
  const isPartial = coverageStart ? periodStart < coverageStart : false;

  const sellers = await prisma.externalSeller.findMany({
    where: {
      organizationId,
      externalCode: { in: facts.map((fact) => fact.sellerExternalCode) },
    },
  });
  const sellerByCode = new Map(
    sellers.map((seller) => [seller.externalCode, seller]),
  );

  // Só entram vendedores COM venda na janela: sem meta para perseguir, uma
  // lista de zeros num "Diário" não diz nada e enterra quem vendeu.
  let invoicedTotal = 0;
  let pipelineTotal = 0;

  const entries = facts.map((fact) => {
    const seller = sellerByCode.get(fact.sellerExternalCode);
    const invoicedRevenue = Number(fact._sum.revenue ?? 0);
    const pipelineRevenue = Number(fact._sum.revenuePipeline ?? 0);
    invoicedTotal += invoicedRevenue;
    pipelineTotal += pipelineRevenue;

    // Métricas do recorte ativo.
    const revenue = isPipeline ? pipelineRevenue : invoicedRevenue;
    const cost = Number(
      (isPipeline ? fact._sum.costPipeline : fact._sum.cost) ?? 0,
    );
    const orders = Number(
      (isPipeline ? fact._sum.ordersPipeline : fact._sum.orders) ?? 0,
    );
    const customers = Number(
      (isPipeline ? fact._sum.customersPipeline : fact._sum.customers) ?? 0,
    );
    const name = seller?.name ?? `Código ${fact.sellerExternalCode}`;

    return {
      // Período virtual não existe no banco: id sintético e estável, para o
      // React ter key e a UI não tentar editar o que não é persistido.
      id: `virtual:${periodType}:${fact.sellerExternalCode}`,
      externalCode: fact.sellerExternalCode,
      goalName: name,
      sellerName: name,
      entryKind: seller?.isBucket ? ("BUCKET" as const) : ("SELLER" as const),
      goalAmount: 0,
      achievedAmount: revenue,
      percentAchieved: null,
      remainingAmount: 0,
      memberId: seller?.memberId ?? null,
      photoUrl: null,
      achievedSource: "AUTO" as const,
      metrics: {
        revenue,
        cost,
        margin: revenue - cost,
        marginPercent: revenue > 0 ? ((revenue - cost) / revenue) * 100 : null,
        orders,
        customers,
        averageTicket: orders > 0 ? revenue / orders : null,
      },
      projectedAmount: null,
      projectedPercent: null,
      // Equipe = supervisor (PCSUPERV), a divisão comercial do Winthor. Campos
      // intermediários só para agrupar/rotular abaixo — removidos da entry final.
      teamCode: seller?.supervisorCode ?? null,
      teamName: seller?.supervisorName?.trim() || null,
    };
  });

  entries.sort((a, b) => b.achievedAmount - a.achievedAmount);

  const byTeam = new Map<string, typeof entries>();
  for (const entry of entries) {
    const key = entry.teamCode ?? "none";
    const list = byTeam.get(key) ?? [];
    list.push(entry);
    byTeam.set(key, list);
  }

  const branches = [...byTeam.values()]
    .map((teamEntries) => ({
      id: `virtual:team:${teamEntries[0]?.teamCode ?? "none"}`,
      name: teamEntries[0]?.teamName ?? "Sem equipe",
      isActive: true,
      // Equipe vem do ERP: não há meta geral própria pra sobrescrever aqui.
      goalAmountOverride: null,
      goalTotal: 0,
      achievedTotal: teamEntries.reduce(
        (total, entry) => total + entry.achievedAmount,
        0,
      ),
      entries: teamEntries.map(
        ({ teamCode: _teamCode, teamName: _teamName, ...entry }) => entry,
      ),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const achievedTotal = entries.reduce(
    (total, entry) => total + entry.achievedAmount,
    0,
  );
  const revenueTotal = entries.reduce(
    (total, entry) => total + entry.metrics.revenue,
    0,
  );
  const costTotal = entries.reduce(
    (total, entry) => total + entry.metrics.cost,
    0,
  );
  const ordersTotal = entries.reduce(
    (total, entry) => total + entry.metrics.orders,
    0,
  );

  return {
    id: `virtual:${periodType}:${periodStart.toISOString().slice(0, 10)}`,
    periodType,
    periodStart,
    periodEnd,
    label,
    // Período vem do ERP: não há meta geral própria pra sobrescrever aqui.
    overallGoalAmount: null,
    goalTotal: 0,
    achievedTotal,
    branches,
    achievedSourceKind: "ERP" as const,
    // Data em que o espelho começa, quando a janela pedida é maior que ele.
    // A UI avisa; sem isso o número passaria por total do período.
    coverageStart:
      isPartial && coverageStart
        ? coverageStart.toISOString().slice(0, 10)
        : null,
    // Sem meta não há o que projetar contra; a faixa de performance omite.
    pace: undefined,
    projectedTotal: null,
    projectedPercent: null,
    marginTotal: revenueTotal > 0 ? revenueTotal - costTotal : null,
    marginPercent:
      revenueTotal > 0
        ? ((revenueTotal - costTotal) / revenueTotal) * 100
        : null,
    averageTicket: ordersTotal > 0 ? revenueTotal / ordersTotal : null,
    ordersTotal,
    salesMode,
    invoicedTotal,
    pipelineTotal,
  };
}
