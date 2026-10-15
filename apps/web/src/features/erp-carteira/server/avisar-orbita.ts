import "server-only";

import { decryptSecret } from "@/lib/nasa-s2s-crypto";
import { buildOrbitaHeaders } from "@/features/orbita-orders/lib/sign";
import { findOrbitaPushKey } from "@/features/orbita-orders/server/find-push-key";

export const ORBITA_CARTEIRA_PATH = "/api/integrations/nerp/erp-carteira";
const TIMEOUT_MS = 15_000;

/**
 * Avisa o Órbita que a sincronização diária do Winthor terminou, para ele
 * reimportar só os clientes que mudaram desde a última vez. Sem chave de
 * integração ativa ou sem `NASA_SYNC_BASE_URL`, não há quem avisar.
 */
export async function avisarOrbitaCarteiraAtualizada(
  organizationId: string,
): Promise<"avisado" | "sem-integracao"> {
  const baseUrl = process.env.NASA_SYNC_BASE_URL?.replace(/\/$/, "");
  const key = await findOrbitaPushKey(organizationId);
  if (!baseUrl || !key) return "sem-integracao";

  const body = JSON.stringify({ syncedAt: new Date().toISOString() });
  const response = await fetch(`${baseUrl}${ORBITA_CARTEIRA_PATH}`, {
    method: "POST",
    headers: buildOrbitaHeaders({
      apiKey: key.apiKey,
      organizationId,
      secret: decryptSecret(key.secretCiphertext),
      body,
      timestamp: Date.now().toString(),
      path: ORBITA_CARTEIRA_PATH,
    }),
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`carteira→órbita: HTTP ${response.status}`);
  }
  return "avisado";
}
