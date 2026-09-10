import "server-only";

import { apagarOrganizacao } from "@/features/organization/server/apagar-organizacao";
import prisma from "@/lib/db";

/**
 * Ciclo de vida da sandbox: avisa aos 23 dias sem acesso, apaga aos 30.
 *
 * "Sem acesso" é `lastAccessAt`, que `currentOrganization()` toca com
 * throttle de uma hora. O aviso é uma marca (`expiryWarnedAt`) que o banner
 * lê — e a Fase 5 transforma em aviso falado pelo Astro. Nada aqui usa IA.
 */

export const DIAS_PARA_AVISAR = 23;
export const DIAS_PARA_APAGAR = 30;

const DIA_MS = 24 * 60 * 60 * 1000;

export async function listarSandboxesParaAvisar(agora = new Date()) {
  const corte = new Date(agora.getTime() - DIAS_PARA_AVISAR * DIA_MS);
  return prisma.organization.findMany({
    where: {
      verifiedAt: null,
      expiryWarnedAt: null,
      OR: [
        { lastAccessAt: { lt: corte } },
        { lastAccessAt: null, createdAt: { lt: corte } },
      ],
    },
    select: { id: true },
  });
}

export async function avisarSandboxes(agora = new Date()): Promise<number> {
  const alvos = await listarSandboxesParaAvisar(agora);
  if (alvos.length === 0) return 0;
  const { count } = await prisma.organization.updateMany({
    where: { id: { in: alvos.map((o) => o.id) }, expiryWarnedAt: null },
    data: { expiryWarnedAt: agora },
  });
  return count;
}

export async function listarSandboxesExpiradas(agora = new Date()) {
  const corte = new Date(agora.getTime() - DIAS_PARA_APAGAR * DIA_MS);
  return prisma.organization.findMany({
    where: {
      verifiedAt: null,
      OR: [
        { lastAccessAt: { lt: corte } },
        { lastAccessAt: null, createdAt: { lt: corte } },
      ],
    },
    select: { id: true },
  });
}

/** Apaga uma sandbox expirada e a conta provisória dela. Reconfere antes. */
export async function apagarSandboxExpirada(
  organizationId: string,
  agora = new Date(),
): Promise<boolean> {
  const corte = new Date(agora.getTime() - DIAS_PARA_APAGAR * DIA_MS);
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { verifiedAt: true, lastAccessAt: true, createdAt: true },
  });
  if (!org || org.verifiedAt) return false;
  const ultimo = org.lastAccessAt ?? org.createdAt;
  if (ultimo >= corte) return false;
  await apagarOrganizacao(organizationId, { apagarDonoAnonimo: true });
  return true;
}
