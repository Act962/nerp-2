import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { lerValidade } from "@/features/integracoes/server/certificado";
import { cifrarCredenciais } from "@/features/integracoes/server/credentials";
import prisma from "@/lib/db";
import { requireOrgAdmin } from "./_access";
import { montarCredenciais } from "./_credenciais";
import { credenciaisInputSchema } from "./_schema";

// Instala (ou reconfigura) um provedor do catálogo para a organização.
export const installIntegracao = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Instalar integração do catálogo",
    tags: ["integracoes"],
  })
  .input(credenciaisInputSchema)
  .handler(async ({ input, context }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    const { manifest, valores } = await montarCredenciais(
      context.org.id,
      input,
    );

    // A validade sai do próprio certificado — data digitada à mão erra e o
    // aviso de vencimento perde o sentido.
    const pemCertificado = valores.certificado ?? valores.cert ?? null;
    const certificateExpiresAt = pemCertificado
      ? lerValidade(pemCertificado)
      : null;

    const dados = {
      category: manifest.categoria,
      status: "ACTIVE" as const,
      credentialsCiphertext: cifrarCredenciais(valores),
      certificateExpiresAt,
      environment: input.environment,
      displayName: input.displayName || manifest.nome,
      capabilities: manifest.capacidades,
      installedById: context.user.id,
      // Reconfigurar é a forma de sair de ERROR — limpa a falha anterior.
      lastSyncError: null,
    };

    const integracao = await prisma.financialIntegration.upsert({
      where: {
        organizationId_providerId_externalRef: {
          organizationId: context.org.id,
          providerId: input.providerId,
          externalRef: input.externalRef,
        },
      },
      create: {
        organizationId: context.org.id,
        providerId: input.providerId,
        externalRef: input.externalRef,
        ...dados,
      },
      update: dados,
      select: { id: true },
    });

    return { id: integracao.id };
  });
