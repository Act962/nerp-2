import "server-only";
import { decifrarCredenciais } from "@/features/integracoes/server/credentials";
import type { AsaasEnv } from "@/lib/asaas";
import prisma from "@/lib/db";
import type { ProvedorDePagamento } from "../lib/porta";
import { criarProvedorAsaas } from "./asaas-provedor";

export type GatewayResolvido = {
  provedor: ProvedorDePagamento;
  integrationId: string;
  /** Segredo com que o provedor assina o webhook; vazio quando não configurado. */
  webhookSecret: string;
};

/**
 * O gateway daquela organização, ou nada.
 *
 * A credencial mora em `FinancialIntegration` — o mesmo cofre cifrado e a mesma
 * tela de instalação que bancos e adquirentes já usam. Não existe tabela
 * própria de gateway de propósito: um segundo lugar para guardar chave é um
 * segundo lugar de onde ela pode vazar.
 *
 * Devolver `null` em vez de lançar também é deliberado: organização sem gateway
 * instalado continua no fluxo da Fase 1 — pedido entra aguardando aceite, sem
 * cobrança. Quem ainda não configurou não pode ficar sem vender.
 */
export async function resolverGateway(
  organizationId: string,
): Promise<GatewayResolvido | null> {
  const instalacao = await prisma.financialIntegration.findFirst({
    where: {
      organizationId,
      category: "GATEWAY",
      status: "ACTIVE",
      providerId: "asaas",
    },
    select: {
      id: true,
      environment: true,
      credentialsCiphertext: true,
    },
  });

  if (!instalacao?.credentialsCiphertext) return null;

  const credenciais = decifrarCredenciais(instalacao.credentialsCiphertext);
  const apiKey = credenciais.apiKey;
  if (!apiKey) {
    console.warn(
      `[pagamentos] instalação do Asaas sem apiKey; org ${organizationId}`,
    );
    return null;
  }

  return {
    integrationId: instalacao.id,
    webhookSecret: credenciais.webhookSecret ?? "",
    provedor: criarProvedorAsaas({
      apiKey,
      // O catálogo grava "producao" (sem cedilha e sem acento); o Asaas espera
      // "production". A tradução mora aqui, no único ponto que conhece os dois.
      environment: (instalacao.environment === "producao"
        ? "production"
        : "sandbox") as AsaasEnv,
    }),
  };
}
