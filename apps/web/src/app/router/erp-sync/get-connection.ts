import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { parseOracleConfig } from "@/features/erp-sync/server/connectors";
import prisma from "@/lib/db";
import { requireOrgAdmin } from "./_access";

// Config da conexão para preencher o formulário de Integrações. Devolve host,
// porta, service, schema e usuário — mas NUNCA a senha (só um flag dizendo que
// existe). Admin-only: são credenciais de banco.
export const getErpConnection = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Configuração da conexão de ERP (sem senha)",
    tags: ["erp-sync"],
  })
  .handler(async ({ context }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    const connection = await prisma.erpConnection.findUnique({
      where: { organizationId: context.org.id },
      select: {
        kind: true,
        status: true,
        configCiphertext: true,
        lastSyncAt: true,
        lastSyncError: true,
      },
    });

    if (!connection) {
      return { configured: false as const };
    }

    // Decifra só para expor os campos não-secretos. Se a chave de cifra mudou ou
    // o blob corrompeu, não estoura a tela — devolve "sem config legível".
    let config: ReturnType<typeof parseOracleConfig> | null = null;
    if (connection.configCiphertext) {
      try {
        config = parseOracleConfig(connection.configCiphertext);
      } catch {
        config = null;
      }
    }

    return {
      configured: true as const,
      kind: connection.kind,
      status: connection.status,
      lastSyncAt: connection.lastSyncAt?.toISOString() ?? null,
      lastSyncError: connection.lastSyncError,
      hasCredentials: config !== null,
      host: config?.host ?? "",
      port: config?.port ?? 1521,
      serviceName: config?.serviceName ?? "",
      schema: config?.schema ?? "",
      user: config?.user ?? "",
    };
  });
