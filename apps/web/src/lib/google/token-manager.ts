import "server-only";
import { decryptAppSecret } from "@/lib/crypto/app-secret";
import prisma from "@/lib/db";
import { refreshAccessToken } from "./drive";

// Renova o accessToken se estiver ≤ 60s de vencer. Só o refresh_token fica
// cifrado — accessToken é curto (1h) e vai ser rotacionado por conta própria.
// Se o refresh Google falhar (revogado, senha trocada), removemos a conexão
// pra o usuário reconectar do zero.
export async function getFreshGoogleAccessToken(connectionId: string): Promise<{
  accessToken: string;
  connection: {
    id: string;
    organizationId: string;
    userId: string;
    googleEmail: string;
  };
}> {
  const conn = await prisma.googleDriveConnection.findUnique({
    where: { id: connectionId },
  });
  if (!conn) throw new Error("Conexão Google Drive não encontrada");

  const remaining = conn.expiresAt.getTime() - Date.now();
  if (remaining > 60_000) {
    return {
      accessToken: conn.accessToken,
      connection: {
        id: conn.id,
        organizationId: conn.organizationId,
        userId: conn.userId,
        googleEmail: conn.googleEmail,
      },
    };
  }

  try {
    const refreshToken = decryptAppSecret(conn.refreshToken);
    const refreshed = await refreshAccessToken(refreshToken);
    const nextExpires = new Date(Date.now() + refreshed.expires_in * 1000);
    await prisma.googleDriveConnection.update({
      where: { id: conn.id },
      data: {
        accessToken: refreshed.access_token,
        expiresAt: nextExpires,
        // Google raramente rotaciona o refresh_token; se rotacionar (campo
        // ausente na resposta), mantemos o antigo (que continua válido).
      },
    });
    return {
      accessToken: refreshed.access_token,
      connection: {
        id: conn.id,
        organizationId: conn.organizationId,
        userId: conn.userId,
        googleEmail: conn.googleEmail,
      },
    };
  } catch {
    // Refresh irrecuperável — apaga a conexão pra o usuário reconectar.
    await prisma.googleDriveConnection
      .delete({ where: { id: conn.id } })
      .catch(() => {});
    throw new Error(
      "Sessão Google expirou. Reconecte em Integrações → Google Drive.",
    );
  }
}
