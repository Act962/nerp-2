import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { parseOracleConfig } from "@/features/erp-sync/server/connectors";
import { testWinthorConfig } from "@/features/erp-sync/server/connectors/winthor";
import prisma from "@/lib/db";
import { requireOrgAdmin } from "./_access";
import { winthorConnectionInputSchema } from "./_schema";

// Testa a conexão com os valores do formulário ANTES de salvar. Senha em branco
// reaproveita a já cifrada. Nunca devolve exceção crua — a mensagem do Oracle
// (ORA-xxxxx) vira texto amigável, e um erro de conexão não é 500.
export const testErpConnection = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Testar conexão de ERP (Winthor/Oracle)",
    tags: ["erp-sync"],
  })
  .input(winthorConnectionInputSchema)
  .handler(async ({ input, context, errors }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    let password = input.password?.trim() ? input.password : null;
    if (!password) {
      const existing = await prisma.erpConnection.findUnique({
        where: { organizationId: context.org.id },
        select: { configCiphertext: true },
      });
      if (existing?.configCiphertext) {
        try {
          password = parseOracleConfig(existing.configCiphertext).password;
        } catch {
          password = null;
        }
      }
    }
    if (!password) {
      throw errors.BAD_REQUEST({
        message: "Informe a senha do banco para testar a conexão.",
      });
    }

    try {
      const { sellerCount } = await testWinthorConfig({
        host: input.host.trim(),
        port: input.port,
        serviceName: input.serviceName.trim(),
        schema: input.schema.trim(),
        user: input.user.trim(),
        password,
      });
      return {
        ok: true as const,
        sellerCount,
        message: `Conexão OK — ${sellerCount} vendedores no cadastro.`,
      };
    } catch (error) {
      // Falha esperada (credencial/host/schema errado) — resultado, não exceção.
      return {
        ok: false as const,
        sellerCount: 0,
        message: (error as Error).message.slice(0, 300),
      };
    }
  });
