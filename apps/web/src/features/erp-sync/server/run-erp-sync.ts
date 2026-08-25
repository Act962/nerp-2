import "server-only";
import prisma from "@/lib/db";
import { resolveSalesConnector } from "./connectors";

// Espelha o ERP nas tabelas canônicas. É a única escrita do módulo — e é toda
// no Postgres do NERP: o ERP do cliente nunca recebe nada além de SELECT.

export interface ErpSyncResult {
  kind: string;
  sellers: number;
  facts: number;
  from: string;
  to: string;
  /** Códigos que aparecem em venda mas não no cadastro de vendedores. */
  orphanSellerCodes: string[];
}

const DEFAULT_WINDOW_DAYS = 90;

// Quantos upserts de vendedor rodam em paralelo. Sequencial eram ~334
// ida-e-volta por sync; o teto evita estourar o pool de conexões do Postgres.
const SELLER_UPSERT_CONCURRENCY = 25;

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export async function runErpSync(
  organizationId: string,
  options: { windowDays?: number; from?: Date; to?: Date } = {},
): Promise<ErpSyncResult> {
  const connector = await resolveSalesConnector(organizationId);

  const to = startOfUtcDay(options.to ?? new Date());
  const from =
    options.from ??
    new Date(
      to.getTime() -
        (options.windowDays ?? DEFAULT_WINDOW_DAYS) * 24 * 60 * 60 * 1000,
    );

  // Marca "sincronizando" já no início, não só na procedure manual: assim o
  // cron também aparece como em andamento e uma execução do cron não limpa a
  // flag de um clique manual antes da hora (cada run reinstala a sua).
  await prisma.erpConnection
    .updateMany({
      where: { organizationId },
      data: { syncStartedAt: new Date() },
    })
    .catch(() => {});

  try {
    const sellers = await connector.sellers();

    // `memberId` fica de fora do update de propósito: o vínculo com o membro é
    // trabalho humano e não pode ser desfeito por um sync automático.
    // Em lotes concorrentes (não sequencial) para não fazer ~334 round-trips
    // em série a cada sync.
    for (let i = 0; i < sellers.length; i += SELLER_UPSERT_CONCURRENCY) {
      await Promise.all(
        sellers.slice(i, i + SELLER_UPSERT_CONCURRENCY).map((seller) =>
          prisma.externalSeller.upsert({
            where: {
              organizationId_externalCode: {
                organizationId,
                externalCode: seller.externalCode,
              },
            },
            create: { organizationId, ...seller },
            update: {
              name: seller.name,
              branchCode: seller.branchCode,
              supervisorCode: seller.supervisorCode,
              supervisorName: seller.supervisorName,
              isBucket: seller.isBucket,
              isActive: seller.isActive,
            },
          }),
        ),
      );
    }

    const facts = await connector.salesBySellerDaily({ from, to });

    const knownCodes = new Set(sellers.map((seller) => seller.externalCode));
    const orphanSellerCodes = [
      ...new Set(
        facts
          .map((fact) => fact.sellerExternalCode)
          .filter((code) => !knownCodes.has(code)),
      ),
    ];

    // Recria a janela inteira em vez de upsert linha a linha: o espelho fica
    // idêntico à origem mesmo quando um pedido muda de status ou some.
    await prisma.$transaction(
      async (tx) => {
        await tx.salesFactDaily.deleteMany({
          where: { organizationId, date: { gte: from, lte: to } },
        });
        if (facts.length > 0) {
          await tx.salesFactDaily.createMany({
            data: facts.map((fact) => ({ organizationId, ...fact })),
          });
        }
      },
      { timeout: 60_000 },
    );

    // Volta para ACTIVE de propósito: sem isso uma falha isolada deixaria a
    // conexão marcada como ERROR para sempre, mesmo já tendo se recuperado.
    await prisma.erpConnection.updateMany({
      where: { organizationId },
      data: {
        status: "ACTIVE",
        lastSyncAt: new Date(),
        lastSyncError: null,
        syncStartedAt: null,
      },
    });

    return {
      kind: connector.kind,
      sellers: sellers.length,
      facts: facts.length,
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      orphanSellerCodes,
    };
  } catch (error) {
    await prisma.erpConnection
      .updateMany({
        where: { organizationId },
        data: {
          status: "ERROR",
          lastSyncError: (error as Error).message.slice(0, 500),
          syncStartedAt: null,
        },
      })
      .catch(() => {});
    throw error;
  }
}

/**
 * Organizações que o cron deve sincronizar.
 *
 * `ERROR` continua na lista: falha de rede é transitória, e excluí-la deixaria
 * a organização sem sync para sempre até alguém reparar no problema. Só `PAUSED`
 * — que é decisão humana — tira a org do agendamento.
 */
export async function listOrganizationsForSync(): Promise<string[]> {
  const connections = await prisma.erpConnection.findMany({
    where: { kind: { not: "NATIVE" }, status: { not: "PAUSED" } },
    select: { organizationId: true },
  });
  return connections.map((connection) => connection.organizationId);
}
