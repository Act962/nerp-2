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
 * Retorna `null` (não lança) quando não é um request de device: sem bearer, ou
 * bearer que não bate num `Device` válido. O `null` faz o request cair no fluxo
 * de sessão normal (cookie), que decide 200/401 — assim o caminho existente
 * segue intacto.
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

  const [org, user] = await Promise.all([
    prisma.organization.findUnique({ where: { id: device.organizationId } }),
    prisma.user.findUnique({ where: { id: device.userId } }),
  ]);
  if (!org || !user) return null;

  // Carimbo de atividade, best-effort — não bloqueia a request nem falha nela.
  void prisma.device
    .update({ where: { id: device.id }, data: { lastSeenAt: new Date() } })
    .catch(() => {});

  return { org, user, device, scopes: device.scopes };
}
