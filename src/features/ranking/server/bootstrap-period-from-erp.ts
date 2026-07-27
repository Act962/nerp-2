import "server-only";
import prisma from "@/lib/db";

// Cria o esqueleto do período a partir do cadastro de vendedores do ERP, para o
// board sair do zero sem esperar a planilha: as equipes e as linhas de vendedor
// nascem prontas e o "vendido" já vem do espelho do ERP.
//
// A meta NÃO é inventada aqui — nasce zerada e é preenchida pela planilha ou à
// mão. `PCMETA` do Winthor está abandonado, então não há meta para importar.

export interface BootstrapResult {
  periodId: string;
  branches: number;
  entriesCreated: number;
  entriesKept: number;
}

function monthBounds(reference: Date) {
  const year = reference.getUTCFullYear();
  const month = reference.getUTCMonth();
  return {
    // `periodEnd` é 00:00 do último dia — mesma convenção do parser da planilha.
    periodStart: new Date(Date.UTC(year, month, 1)),
    periodEnd: new Date(Date.UTC(year, month + 1, 0)),
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

export async function bootstrapPeriodFromErp(
  organizationId: string,
  options: { reference?: Date } = {},
): Promise<BootstrapResult> {
  const reference = options.reference ?? new Date();
  const { periodStart, periodEnd } = monthBounds(reference);
  const label = `${MONTHS_PT[reference.getUTCMonth()]}/${reference.getUTCFullYear()}`;

  const sellers = await prisma.externalSeller.findMany({
    where: { organizationId, isActive: true },
    orderBy: [{ branchCode: "asc" }, { name: "asc" }],
  });

  if (sellers.length === 0) {
    throw new Error(
      "Nenhum vendedor ativo espelhado do ERP. Rode o sync antes do bootstrap.",
    );
  }

  const byBranch = new Map<string, typeof sellers>();
  for (const seller of sellers) {
    const key = seller.branchCode ?? "—";
    const list = byBranch.get(key) ?? [];
    list.push(seller);
    byBranch.set(key, list);
  }

  return prisma.$transaction(
    async (tx) => {
      const period = await tx.salesGoalPeriod.upsert({
        where: {
          organizationId_periodType_periodStart: {
            organizationId,
            periodType: "MONTHLY",
            periodStart,
          },
        },
        create: {
          organizationId,
          periodType: "MONTHLY",
          periodStart,
          periodEnd,
          label,
        },
        update: { periodEnd },
      });

      let entriesCreated = 0;
      let entriesKept = 0;
      let sortOrder = 0;

      for (const [branchCode, branchSellers] of [
        ...byBranch.entries(),
      ].sort()) {
        const name = branchCode === "—" ? "Sem filial" : `Filial ${branchCode}`;
        const branch = await tx.salesGoalBranch.upsert({
          where: { periodId_name: { periodId: period.id, name } },
          create: { periodId: period.id, name, sortOrder: sortOrder++ },
          update: {},
        });

        for (const seller of branchSellers) {
          const existing = await tx.salesGoalEntry.findUnique({
            where: {
              branchId_externalCode: {
                branchId: branch.id,
                externalCode: seller.externalCode,
              },
            },
            select: { id: true },
          });

          if (existing) {
            // Meta e vendido manual são de quem cadastrou — o bootstrap só
            // atualiza o que é espelho do ERP.
            await tx.salesGoalEntry.update({
              where: { id: existing.id },
              data: {
                sellerName: seller.name,
                entryKind: seller.isBucket ? "BUCKET" : "SELLER",
              },
            });
            entriesKept++;
            continue;
          }

          await tx.salesGoalEntry.create({
            data: {
              branchId: branch.id,
              externalCode: seller.externalCode,
              sellerName: seller.name,
              goalName: seller.name,
              goalAmount: 0,
              entryKind: seller.isBucket ? "BUCKET" : "SELLER",
              memberId: seller.memberId,
            },
          });
          entriesCreated++;
        }
      }

      return {
        periodId: period.id,
        branches: byBranch.size,
        entriesCreated,
        entriesKept,
      };
    },
    { timeout: 60_000 },
  );
}
