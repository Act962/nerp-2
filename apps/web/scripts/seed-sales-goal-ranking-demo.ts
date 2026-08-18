/**
 * Seed de demonstração do Ranking de Equipes (metas + vendido automático).
 * Uso: SEED_ORG_ID=<id-da-organizacao> pnpm dlx tsx scripts/seed-sales-goal-ranking-demo.ts
 *
 * Cria um período "Meta do mês" com 2 filiais e vincula a primeira entry
 * SELLER da filial CAPITAL ao primeiro Member da organização, criando também
 * 2 vendas COMPLETED para esse usuário no período — exercita o caminho AUTO
 * (vendido calculado de Sale) além do caminho MANUAL (demais entries).
 */
import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const ORG_ID = process.env.SEED_ORG_ID;

const now = new Date();
const PERIOD_START = new Date(
  Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
);
const PERIOD_END = new Date(
  Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
);

interface SeedEntry {
  externalCode: string;
  sellerName: string;
  goalAmount: number;
  achievedAmount: number | null;
  entryKind: "SELLER" | "BUCKET";
}

interface SeedBranch {
  name: string;
  entries: SeedEntry[];
}

const BRANCHES: SeedBranch[] = [
  {
    name: "CAPITAL",
    entries: [
      {
        externalCode: "255",
        sellerName: "VENDEDOR VINCULADO (AUTO)",
        goalAmount: 280000,
        achievedAmount: null,
        entryKind: "SELLER",
      },
      {
        externalCode: "287",
        sellerName: "ANTONIO DA SILVA DE SOUSA",
        goalAmount: 250000,
        achievedAmount: 260000,
        entryKind: "SELLER",
      },
      {
        externalCode: "305",
        sellerName: "EDGAR R OLIVEIRA ROCHA",
        goalAmount: 200000,
        achievedAmount: 90000,
        entryKind: "SELLER",
      },
    ],
  },
  {
    name: "NORTE",
    entries: [
      {
        externalCode: "77",
        sellerName: "SHIRLEY MARIA SANTOS COSTA",
        goalAmount: 160000,
        achievedAmount: 170000,
        entryKind: "SELLER",
      },
      {
        externalCode: "376",
        sellerName: "TREINAMENTO",
        goalAmount: 120000,
        achievedAmount: null,
        entryKind: "BUCKET",
      },
    ],
  },
];

async function main() {
  if (!ORG_ID) {
    throw new Error(
      "Defina SEED_ORG_ID (id da organização) antes de rodar o seed.",
    );
  }

  console.log("Seed do Ranking de Equipes — Meta do mês atual\n");

  const period = await prisma.salesGoalPeriod.upsert({
    where: {
      organizationId_periodType_periodStart: {
        organizationId: ORG_ID,
        periodType: "MONTHLY",
        periodStart: PERIOD_START,
      },
    },
    create: {
      organizationId: ORG_ID,
      periodType: "MONTHLY",
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      label: "Meta do mês (demo)",
      sourceFileName: "seed-demo.xlsx",
    },
    update: { periodEnd: PERIOD_END },
  });
  console.log(`Período ${period.label} (${period.id})`);

  let linkedEntryId: string | null = null;

  for (const [index, branchSeed] of BRANCHES.entries()) {
    const branch = await prisma.salesGoalBranch.upsert({
      where: { periodId_name: { periodId: period.id, name: branchSeed.name } },
      create: { periodId: period.id, name: branchSeed.name, sortOrder: index },
      update: { sortOrder: index },
    });

    for (const entry of branchSeed.entries) {
      const created = await prisma.salesGoalEntry.upsert({
        where: {
          branchId_externalCode: {
            branchId: branch.id,
            externalCode: entry.externalCode,
          },
        },
        create: {
          branchId: branch.id,
          externalCode: entry.externalCode,
          sellerName: entry.sellerName,
          goalName: entry.sellerName,
          goalAmount: entry.goalAmount,
          achievedAmount: entry.achievedAmount,
          entryKind: entry.entryKind,
        },
        update: {
          sellerName: entry.sellerName,
          goalName: entry.sellerName,
          goalAmount: entry.goalAmount,
          entryKind: entry.entryKind,
        },
      });
      if (entry.externalCode === "255") linkedEntryId = created.id;
    }
    console.log(
      `Filial ${branchSeed.name} (${branchSeed.entries.length} metas)`,
    );
  }

  const member = await prisma.member.findFirst({
    where: { organizationId: ORG_ID },
    orderBy: { createdAt: "asc" },
  });

  if (!member) {
    console.log(
      "\nNenhum Member encontrado nesta organização — pulando vínculo AUTO.",
    );
  } else if (linkedEntryId) {
    await prisma.salesGoalEntry.update({
      where: { id: linkedEntryId },
      data: { memberId: member.id },
    });
    console.log(
      `Entry "255" vinculada ao member ${member.id} (userId ${member.userId})`,
    );

    const existingSales = await prisma.sale.count({
      where: { organizationId: ORG_ID },
    });
    for (const [i, total] of [180000, 40000].entries()) {
      await prisma.sale.create({
        data: {
          organizationId: ORG_ID,
          saleNumber: existingSales + i + 1,
          status: "COMPLETED",
          subtotal: total,
          total,
          completedAt: new Date(
            PERIOD_START.getTime() + 2 * 24 * 60 * 60 * 1000,
          ),
          createdById: member.userId,
        },
      });
    }
    console.log(
      "2 vendas COMPLETED criadas para o usuário vinculado (total R$ 220.000,00).",
    );
  }

  console.log("\nPronto! Abra /ranking na aba Mensal.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
