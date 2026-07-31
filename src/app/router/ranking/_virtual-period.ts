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
// O ERP entrega o VENDIDO; a meta continua vindo do período cadastrado (a
// planilha importada). Antes era um ou outro: com conexão ativa o board usava
// este período virtual e as metas cadastradas eram simplesmente ignoradas —
// 30 metas de julho existiam no banco e o board mostrava zero para todo mundo.
// Agora os dois se somam, casando pelo `externalCode` (CODUSUR), que é a chave
// estável dos dois lados. Sem meta cadastrada, `goalAmount` segue 0 e o board
// mostra "Sem meta definida", ordenando por valor vendido como antes.

export interface PeriodPace {
  totalDays: number;
  elapsedDays: number;
  /** Fração do período já decorrida, entre 0 e 1. */
  elapsedRatio: number;
  isClosed: boolean;
}

// `periodEnd` chega como 00:00 do último dia (convenção do parser da planilha),
// então o último dia conta inteiro.
export function computePeriodPace(
  periodStart: Date,
  periodEnd: Date,
): PeriodPace {
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const totalDays = Math.max(
    Math.round((periodEnd.getTime() - periodStart.getTime()) / ONE_DAY) + 1,
    1,
  );
  const elapsed =
    Math.floor((Date.now() - periodStart.getTime()) / ONE_DAY) + 1;
  const elapsedDays = Math.min(Math.max(elapsed, 0), totalDays);

  return {
    totalDays,
    elapsedDays,
    elapsedRatio: elapsedDays / totalDays,
    isClosed: elapsedDays >= totalDays,
  };
}

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

  // Meta do período CADASTRADO com a mesma janela. É o único lugar de onde a
  // meta sai — o Oracle não tem meta (PCMETA está abandonada nesta base).
  // Casa por `externalCode`, não por nome: os nomes das equipes da planilha
  // ("NORTE") não batem com os do Winthor ("PI - NORTE"), mas o CODUSUR do
  // vendedor é o mesmo dos dois lados.
  const storedPeriod = await prisma.salesGoalPeriod.findUnique({
    where: {
      organizationId_periodType_periodStart: {
        organizationId,
        periodType,
        periodStart,
      },
    },
    select: {
      overallGoalAmount: true,
      branches: {
        select: {
          entries: { select: { externalCode: true, goalAmount: true } },
        },
      },
    },
  });
  const goalByCode = new Map<string, number>();
  for (const branch of storedPeriod?.branches ?? []) {
    for (const entry of branch.entries) {
      goalByCode.set(entry.externalCode, Number(entry.goalAmount));
    }
  }
  const pace = computePeriodPace(periodStart, periodEnd);

  const factCodes = facts.map((fact) => fact.sellerExternalCode);
  // Quem TEM meta mas não vendeu nada na janela precisa aparecer zerado: num
  // board de metas, sumir com o vendedor que não vendeu esconde justamente o
  // caso que exige ação. (Sem meta, a regra antiga continua: só entra quem
  // vendeu — uma lista de zeros num "Diário" enterraria quem vendeu.)
  const missingGoalCodes = [...goalByCode.keys()].filter(
    (code) => !factCodes.includes(code),
  );

  const sellers = await prisma.externalSeller.findMany({
    where: {
      organizationId,
      externalCode: { in: [...factCodes, ...missingGoalCodes] },
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

    // Meta cadastrada para este vendedor, quando existir. Ausente = 0, que o
    // board já trata como "sem meta definida".
    const goalAmount = goalByCode.get(fact.sellerExternalCode) ?? 0;
    const projectedAmount =
      pace.elapsedRatio > 0 ? revenue / pace.elapsedRatio : null;

    return {
      // Período virtual não existe no banco: id sintético e estável, para o
      // React ter key e a UI não tentar editar o que não é persistido.
      id: `virtual:${periodType}:${fact.sellerExternalCode}`,
      externalCode: fact.sellerExternalCode,
      goalName: name,
      sellerName: name,
      entryKind: seller?.isBucket ? ("BUCKET" as const) : ("SELLER" as const),
      goalAmount,
      achievedAmount: revenue,
      percentAchieved: goalAmount > 0 ? (revenue / goalAmount) * 100 : null,
      remainingAmount: Math.max(goalAmount - revenue, 0),
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
      projectedAmount,
      projectedPercent:
        projectedAmount !== null && goalAmount > 0
          ? (projectedAmount / goalAmount) * 100
          : null,
      // Equipe = supervisor (PCSUPERV), a divisão comercial do Winthor. Campos
      // intermediários só para agrupar/rotular abaixo — removidos da entry final.
      teamCode: seller?.supervisorCode ?? null,
      teamName: seller?.supervisorName?.trim() || null,
    };
  });

  // Vendedores com meta e sem NENHUMA venda na janela: entram zerados, para a
  // meta deles pesar no total da equipe e a ausência ficar visível.
  for (const code of missingGoalCodes) {
    const seller = sellerByCode.get(code);
    const name = seller?.name ?? `Código ${code}`;
    const goalAmount = goalByCode.get(code) ?? 0;
    entries.push({
      id: `virtual:${periodType}:${code}`,
      externalCode: code,
      goalName: name,
      sellerName: name,
      entryKind: seller?.isBucket ? ("BUCKET" as const) : ("SELLER" as const),
      goalAmount,
      achievedAmount: 0,
      percentAchieved: goalAmount > 0 ? 0 : null,
      remainingAmount: goalAmount,
      memberId: seller?.memberId ?? null,
      photoUrl: null,
      achievedSource: "AUTO" as const,
      metrics: {
        revenue: 0,
        cost: 0,
        margin: 0,
        marginPercent: null,
        orders: 0,
        customers: 0,
        averageTicket: null,
      },
      projectedAmount: 0,
      projectedPercent: goalAmount > 0 ? 0 : null,
      teamCode: seller?.supervisorCode ?? null,
      teamName: seller?.supervisorName?.trim() || null,
    });
  }

  // Mesmo desempate do período cadastrado: com meta, ordena por % atingido;
  // sem meta (percentAchieved null) cai no valor vendido.
  entries.sort(
    (a, b) =>
      (b.percentAchieved ?? -1) - (a.percentAchieved ?? -1) ||
      b.achievedAmount - a.achievedAmount,
  );

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
      // A equipe aqui vem do ERP (agrupada por supervisor), então não há
      // override próprio: a meta da equipe é a soma das metas dos vendedores
      // dela. O override por equipe da planilha não é aplicado porque os nomes
      // não são a mesma chave — depende do `supervisorCode` na SalesGoalBranch.
      goalAmountOverride: null,
      goalTotal: teamEntries.reduce(
        (total, entry) => total + entry.goalAmount,
        0,
      ),
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

  // Meta geral: honra o override do período cadastrado, quando houver; senão
  // soma as metas das equipes (que somam as dos vendedores).
  const overallGoalAmount =
    storedPeriod?.overallGoalAmount != null
      ? Number(storedPeriod.overallGoalAmount)
      : null;
  const goalTotal =
    overallGoalAmount ??
    branches.reduce((total, branch) => total + branch.goalTotal, 0);

  return {
    id: `virtual:${periodType}:${periodStart.toISOString().slice(0, 10)}`,
    periodType,
    periodStart,
    periodEnd,
    label,
    overallGoalAmount,
    goalTotal,
    achievedTotal,
    branches,
    achievedSourceKind: "ERP" as const,
    // Data em que o espelho começa, quando a janela pedida é maior que ele.
    // A UI avisa; sem isso o número passaria por total do período.
    coverageStart:
      isPartial && coverageStart
        ? coverageStart.toISOString().slice(0, 10)
        : null,
    // Ritmo/projeção só fazem sentido contra uma meta. Sem meta cadastrada
    // segue `undefined` e a UI omite a faixa de performance, como antes.
    pace: goalTotal > 0 ? pace : undefined,
    projectedTotal:
      goalTotal > 0 && pace.elapsedRatio > 0
        ? achievedTotal / pace.elapsedRatio
        : null,
    projectedPercent:
      goalTotal > 0 && pace.elapsedRatio > 0
        ? (achievedTotal / pace.elapsedRatio / goalTotal) * 100
        : null,
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
