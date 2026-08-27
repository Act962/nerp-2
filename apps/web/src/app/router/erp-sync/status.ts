import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";

// Sync em andamento há mais que isso é sync travado, não sync rodando: a função
// morreu sem limpar `syncStartedAt`. Sem esse corte o botão ficaria desabilitado
// para sempre.
const SYNC_STUCK_AFTER_MS = 15 * 60 * 1000;

/**
 * O relatório é `Json` no banco, então pode ser qualquer coisa — inclusive uma
 * versão antiga do formato. Valida antes de mandar para a tela: um campo a
 * menos aqui viraria "undefined" no meio de uma contagem.
 */
const productSyncReportSchema = z.object({
  read: z.number(),
  updated: z.number(),
  created: z.number(),
  skippedNoBarcode: z.number(),
  skippedInvalidBarcode: z.number(),
  createSkipped: z.number(),
  duplicatesInSource: z.number(),
  failed: z.number(),
  dryRun: z.boolean(),
});

function parseProductSyncReport(
  raw: unknown,
  at: Date | null,
  dryRun: boolean | null,
) {
  const parsed = productSyncReportSchema.safeParse(raw);
  if (!parsed.success || !at) return null;
  return {
    ...parsed.data,
    at: at.toISOString(),
    // A coluna é a fonte: o JSON pode ser de um formato anterior.
    dryRun: dryRun ?? parsed.data.dryRun,
  };
}

export const getErpSyncStatus = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Situação da integração com o ERP externo",
    tags: ["erp-sync"],
  })
  .handler(async ({ context }) => {
    const connection = await prisma.erpConnection.findUnique({
      where: { organizationId: context.org.id },
      // `configCiphertext` fora do select de propósito: credencial não sai daqui.
      select: {
        kind: true,
        status: true,
        syncStartedAt: true,
        lastSyncAt: true,
        lastSyncError: true,
        productSyncAt: true,
        productSyncDryRun: true,
        productSyncReport: true,
      },
    });

    if (!connection || connection.kind === "NATIVE") {
      return { configured: false as const };
    }

    const [sellers, facts, lastFact] = await Promise.all([
      prisma.externalSeller.count({
        where: { organizationId: context.org.id, isActive: true },
      }),
      prisma.salesFactDaily.count({
        where: { organizationId: context.org.id },
      }),
      prisma.salesFactDaily.findFirst({
        where: { organizationId: context.org.id },
        orderBy: { date: "desc" },
        select: { date: true },
      }),
    ]);

    const startedAt = connection.syncStartedAt;
    const isStuck =
      startedAt !== null &&
      Date.now() - startedAt.getTime() > SYNC_STUCK_AFTER_MS;

    return {
      configured: true as const,
      kind: connection.kind,
      status: connection.status,
      isSyncing: startedAt !== null && !isStuck,
      isStuck,
      lastSyncAt: connection.lastSyncAt?.toISOString() ?? null,
      lastSyncError: connection.lastSyncError,
      activeSellers: sellers,
      factRows: facts,
      lastFactDate: lastFact?.date.toISOString().slice(0, 10) ?? null,
      productSync: parseProductSyncReport(
        connection.productSyncReport,
        connection.productSyncAt,
        connection.productSyncDryRun,
      ),
    };
  });
