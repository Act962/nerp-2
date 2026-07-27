import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { parseOracleConfig } from "@/features/erp-sync/server/connectors";
import prisma from "@/lib/db";
import { encryptSecret } from "@/lib/nasa-s2s-crypto";
import { requireOrgAdmin } from "./_access";
import { winthorConnectionInputSchema } from "./_schema";

// Salva/atualiza a conexão Winthor/Oracle, cifrando as credenciais com o mesmo
// cofre do S2S. A senha só entra no blob cifrado — nunca volta pro client.
export const saveErpConnection = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Salvar conexão de ERP (Winthor/Oracle)",
    tags: ["erp-sync"],
  })
  .input(winthorConnectionInputSchema)
  .handler(async ({ input, context, errors }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    const existing = await prisma.erpConnection.findUnique({
      where: { organizationId: context.org.id },
      select: { configCiphertext: true },
    });

    // Senha em branco no update = manter a atual. Recupera a antiga do blob.
    let password = input.password?.trim() ? input.password : null;
    if (!password && existing?.configCiphertext) {
      try {
        password = parseOracleConfig(existing.configCiphertext).password;
      } catch {
        password = null;
      }
    }
    if (!password) {
      throw errors.BAD_REQUEST({
        message: "Informe a senha do banco para configurar a conexão.",
      });
    }

    const configCiphertext = encryptSecret(
      JSON.stringify({
        host: input.host.trim(),
        port: input.port,
        serviceName: input.serviceName.trim(),
        schema: input.schema.trim(),
        user: input.user.trim(),
        password,
      }),
    );

    await prisma.erpConnection.upsert({
      where: { organizationId: context.org.id },
      create: {
        organizationId: context.org.id,
        kind: "WINTHOR_ORACLE",
        status: "ACTIVE",
        configCiphertext,
      },
      // Reativa ao salvar: editar a config é a forma de sair de ERROR/PAUSED.
      update: {
        kind: "WINTHOR_ORACLE",
        status: "ACTIVE",
        configCiphertext,
        lastSyncError: null,
      },
    });

    return { saved: true };
  });
