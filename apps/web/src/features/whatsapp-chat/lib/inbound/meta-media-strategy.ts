import "server-only";

import { downloadInboundMedia } from "@/lib/whatsapp-cloud";
import { extensaoDoMime, guardarMidia, midiaObjectKey } from "../media-storage";
import type { CanonicalInboundMedia } from "../providers/types";

/**
 * Como a mídia recebida da Meta vira um objeto no nosso bucket.
 *
 * É injetada na pipeline como estratégia em vez de ser chamada lá dentro: a
 * pipeline não pode conhecer provedor, e é assim que um segundo provedor entra
 * depois sem tocá-la.
 *
 * Baixamos pelo **id**, não pela URL que veio no webhook: a URL da Meta expira
 * em poucos minutos, e o webhook pode ser reprocessado bem depois disso.
 */
export function criarEstrategiaDeMidiaMeta(input: {
  accessToken: string;
  organizationId: string;
}) {
  return async function baixarMidia(
    canonical: CanonicalInboundMedia,
    conversationId: string,
  ): Promise<{ key: string; mimetype: string } | null> {
    if (!canonical.mediaId) return null;

    const { buffer, mimetype } = await downloadInboundMedia(
      input.accessToken,
      canonical.mediaId,
    );

    const tipo = canonical.mimetype ?? mimetype;
    const key = midiaObjectKey(
      input.organizationId,
      conversationId,
      extensaoDoMime(tipo),
    );
    await guardarMidia(key, buffer, tipo);

    return { key, mimetype: tipo };
  };
}

export type EstrategiaDeMidia = ReturnType<typeof criarEstrategiaDeMidiaMeta>;
