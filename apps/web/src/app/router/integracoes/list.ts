import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { ehSegredo, getManifest } from "@/features/integracoes/catalog";
import {
  decifrarCredenciais,
  mascarar,
} from "@/features/integracoes/server/credentials";
import prisma from "@/lib/db";
import { isOrgAdmin } from "@/lib/org-access";
import { isSuperAdmin } from "@/lib/super-admin";

// O CATÁLOGO não trafega: ele é código (`features/integracoes/catalog`) e o
// client importa direto. Daqui sai só o que é dado — as instalações desta
// organização.
export const listIntegracoes = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Integrações instaladas na organização",
    tags: ["integracoes"],
  })
  .handler(async ({ context }) => {
    const podeGerenciar = await isOrgAdmin(context.org.id, context.user.id);

    // Linha global: a logo do provedor é a mesma para todo inquilino, e todo
    // mundo que vê o catálogo precisa dela para renderizar o card.
    const logos = await prisma.integrationProviderLogo.findMany({
      select: { providerId: true, logoKey: true },
    });

    const instalacoes = await prisma.financialIntegration.findMany({
      where: { organizationId: context.org.id },
      select: {
        id: true,
        providerId: true,
        externalRef: true,
        status: true,
        displayName: true,
        environment: true,
        capabilities: true,
        certificateExpiresAt: true,
        credentialsCiphertext: true,
        lastSyncAt: true,
        lastSyncError: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const conexoesProprias = await carregarConexoesProprias(context.org.id);

    return {
      podeGerenciar,
      podeEditarLogo: isSuperAdmin(context.user.email),
      logos: Object.fromEntries(logos.map((l) => [l.providerId, l.logoKey])),
      instalacoes: [
        ...instalacoes.map((i) => ({
          id: i.id,
          providerId: i.providerId,
          externalRef: i.externalRef,
          status: i.status,
          displayName: i.displayName,
          environment: i.environment,
          capabilities: i.capabilities,
          certificateExpiresAt: i.certificateExpiresAt?.toISOString() ?? null,
          lastSyncAt: i.lastSyncAt?.toISOString() ?? null,
          lastSyncError: i.lastSyncError,
          // Quem não gerencia não recebe nem o campo mascarado: o catálogo é
          // visível para a equipe, a credencial não.
          valores: podeGerenciar
            ? valoresVisiveis(i.providerId, i.credentialsCiphertext)
            : ({} as Record<string, string>),
        })),
        ...conexoesProprias,
      ],
    };
  });

/**
 * Órbita CRM e Winthor têm painel próprio e não moram em `FinancialIntegration`:
 * a conexão do Órbita é a chave que ele usa para chamar o nerp
 * (`NasaIntegrationKey`) e a do Winthor é a `ErpConnection`. Sem entrar aqui, o
 * card mostrava "Conectar" com a integração funcionando.
 */
async function carregarConexoesProprias(organizationId: string) {
  const [chaveOrbita, conexaoErp] = await Promise.all([
    prisma.nasaIntegrationKey.findFirst({
      where: { organizationId, revokedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, lastUsedAt: true },
    }),
    prisma.erpConnection.findUnique({
      where: { organizationId },
      select: {
        id: true,
        kind: true,
        status: true,
        lastSyncAt: true,
        lastSyncError: true,
      },
    }),
  ]);

  const conexoes = [];
  if (chaveOrbita) {
    conexoes.push({
      ...conexaoSemCredencial(chaveOrbita.id, "orbita-crm"),
      status: "ACTIVE" as const,
      lastSyncAt: chaveOrbita.lastUsedAt?.toISOString() ?? null,
      lastSyncError: null,
    });
  }
  if (conexaoErp?.kind === "WINTHOR_ORACLE") {
    conexoes.push({
      ...conexaoSemCredencial(conexaoErp.id, "winthor"),
      status: conexaoErp.status,
      lastSyncAt: conexaoErp.lastSyncAt?.toISOString() ?? null,
      lastSyncError: conexaoErp.lastSyncError,
    });
  }
  return conexoes;
}

function conexaoSemCredencial(id: string, providerId: string) {
  return {
    id,
    providerId,
    externalRef: "",
    displayName: null,
    environment: "producao",
    capabilities: [] as string[],
    certificateExpiresAt: null,
    valores: {} as Record<string, string>,
  };
}

/**
 * Campos de texto voltam preenchidos (para editar sem redigitar); segredo volta
 * mascarado, só para a tela mostrar que existe.
 */
function valoresVisiveis(
  providerId: string,
  ciphertext: string | null,
): Record<string, string> {
  if (!ciphertext) return {};
  const manifest = getManifest(providerId);
  if (!manifest) return {};

  let guardadas: Record<string, string>;
  try {
    guardadas = decifrarCredenciais(ciphertext);
  } catch {
    return {};
  }

  const visiveis: Record<string, string> = {};
  for (const campo of manifest.auth.campos) {
    const valor = guardadas[campo.key];
    if (!valor) continue;
    visiveis[campo.key] = ehSegredo(campo.tipo) ? mascarar(valor) : valor;
  }
  return visiveis;
}
