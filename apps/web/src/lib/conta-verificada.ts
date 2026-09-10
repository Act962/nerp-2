import "server-only";

import { ORPCError } from "@orpc/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import prisma from "./db";

/**
 * Conta verificada = organização com `verifiedAt` preenchido.
 *
 * É a única pergunta que separa uma organização de teste (criada em um clique,
 * sem identidade) de uma de verdade. Não se olha `Account` do Google nem
 * `emailVerified`: todo cliente antigo entrou por senha e tem `emailVerified`
 * falso — a coluna nasce preenchida para eles (backfill) e só fica nula para
 * quem veio pelo "Começar agora".
 *
 * Tudo o que sai para o mundo passa por aqui: vitrine, convite, WhatsApp,
 * ERP, integrações, importação, CNPJ, compra. O que é interno não.
 */

export const CODIGO_CONTA_NAO_VERIFICADA = "CONTA_NAO_VERIFICADA" as const;

export async function contaVerificada(
  organizationId: string,
): Promise<boolean> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { verifiedAt: true },
  });
  return org?.verifiedAt !== null && org?.verifiedAt !== undefined;
}

export class ContaNaoVerificadaError extends ORPCError<
  "FORBIDDEN",
  { code: typeof CODIGO_CONTA_NAO_VERIFICADA; motivo: string }
> {
  constructor(motivo: string) {
    super("FORBIDDEN", {
      message:
        "Crie sua conta com o Google para usar isto. Seus dados de teste ficam com você.",
      data: { code: CODIGO_CONTA_NAO_VERIFICADA, motivo },
    });
  }
}

/** Para procedures oRPC e funções de servidor: lança se a org não é verificada. */
export async function exigirContaVerificada(
  organizationId: string,
  motivo: string,
): Promise<void> {
  if (!(await contaVerificada(organizationId))) {
    throw new ContaNaoVerificadaError(motivo);
  }
}

/** Para páginas: manda para a tela de vínculo com o motivo na URL. */
export async function requireContaVerificada(motivo: string): Promise<void> {
  const org = await auth.api.getFullOrganization({ headers: await headers() });
  if (!org) redirect("/sem-empresa");
  if (!(await contaVerificada(org.id))) {
    redirect(`/vincular-conta?motivo=${encodeURIComponent(motivo)}`);
  }
}
