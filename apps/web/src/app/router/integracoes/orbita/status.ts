import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { isOrgAdmin } from "@/lib/org-access";

/**
 * Estado da conexão com o Órbita CRM.
 *
 * A conexão não é uma linha de `FinancialIntegration`: o catálogo financeiro é
 * de leitura por contrato, e aqui o que existe é uma **chave de acesso que o
 * Órbita usa para chamar o nerp**. A fonte de verdade é `NasaIntegrationKey`.
 *
 * Devolve só metadado — quem autorizou, quando, com quais permissões e quando
 * foi usada pela última vez. A chave e o segredo **nunca** atravessam a
 * fronteira, nem mascarados: diferente de uma credencial que o operador digita
 * e precisa conferir, esta ele nunca viu e nunca vai precisar ver.
 */
export const orbitaStatus = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Estado da conexão com o Órbita CRM",
    tags: ["Integrações"],
  })
  .input(z.object({}))
  .output(
    z.object({
      podeGerenciar: z.boolean(),
      conexao: z
        .object({
          conectadaEm: z.string(),
          autorizadaPor: z.string().nullable(),
          permissoes: z.array(z.string()),
          ultimoUso: z.string().nullable(),
        })
        .nullable(),
    }),
  )
  .handler(async ({ context }) => {
    const organizationId = context.org.id;
    const podeGerenciar = await isOrgAdmin(organizationId, context.user.id);

    const chave = await prisma.nasaIntegrationKey.findFirst({
      where: { organizationId, revokedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        scopes: true,
        lastUsedAt: true,
        consentByUserId: true,
      },
    });

    if (!chave) return { podeGerenciar, conexao: null };

    const autor = await prisma.user.findUnique({
      where: { id: chave.consentByUserId },
      select: { name: true },
    });

    return {
      podeGerenciar,
      conexao: {
        conectadaEm: chave.createdAt.toISOString(),
        autorizadaPor: autor?.name ?? null,
        permissoes: chave.scopes,
        ultimoUso: chave.lastUsedAt?.toISOString() ?? null,
      },
    };
  });
