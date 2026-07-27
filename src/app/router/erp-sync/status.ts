import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";

// Sync em andamento há mais que isso é sync travado, não sync rodando: a função
// morreu sem limpar `syncStartedAt`. Sem esse corte o botão ficaria desabilitado
// para sempre.
const SYNC_STUCK_AFTER_MS = 15 * 60 * 1000;

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
    };
  });
