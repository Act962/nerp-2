import type { Device, Organization, User } from "@/generated/prisma/client";
import prisma from "./db";
import { hashDeviceToken } from "./device-token";

export type DevicePrincipal = {
  org: Organization;
  user: User;
  device: Device;
  scopes: string[];
};

/**
 * Autenticação de dispositivo desktop — espelha `verifyNasaS2S`, mas para um
 * principal de USUÁRIO por device (não uma chave de máquina por org).
 *
 * Retorna `null` (não lança) quando não é um request de device: sem bearer,
 * bearer que não bate num `Device` válido, ou device cujo usuário não é mais
 * membro da org pareada. O `null` faz o request cair no fluxo de sessão normal
 * (cookie), que decide 200/401 — assim o caminho existente segue intacto.
 *
 * Autenticar aqui só diz QUEM é o terminal; o que ele PODE chamar é decidido
 * pelos escopos em `device-scopes.ts`, aplicados no `requireAuthMiddleware`.
 */
export async function verifyDeviceAuth(
  request: Request,
): Promise<DevicePrincipal | null> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;

  const token = authorization.slice("Bearer ".length).trim();
  if (!token) return null;

  const device = await prisma.device.findUnique({
    where: { tokenHash: hashDeviceToken(token) },
  });
  if (!device || device.revokedAt) return null;

  const [org, user, membership] = await Promise.all([
    prisma.organization.findUnique({ where: { id: device.organizationId } }),
    prisma.user.findUnique({ where: { id: device.userId } }),
    // O vínculo é revalidado a CADA request, não só no pareamento: tirar o
    // usuário da organização precisa derrubar os terminais dele junto. Sem
    // isto, o token sobrevive ao desligamento — a org some do menu do usuário
    // e o caixa continua vendendo em nome dele.
    prisma.member.findFirst({
      where: { userId: device.userId, organizationId: device.organizationId },
      select: { id: true },
    }),
  ]);
  if (!org || !user || !membership) return null;

  // Carimbo de atividade, best-effort — não bloqueia a request nem falha nela.
  void prisma.device
    .update({ where: { id: device.id }, data: { lastSeenAt: new Date() } })
    .catch(() => {});

  return { org, user, device, scopes: device.scopes };
}
