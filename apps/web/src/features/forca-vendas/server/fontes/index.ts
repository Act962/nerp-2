import "server-only";

import { criarFonteNativa } from "./nativa";
import type { FonteComercial } from "./porta";

export type { FonteComercial } from "./porta";

/**
 * A fonte dos dados comerciais da organização. No MVP é sempre o NERP.
 *
 * Quando o adaptador do Winthor existir, é aqui que ele entra: a org com uma
 * `ErpConnection` WINTHOR_ORACLE ativa passa a ler dívida, histórico e estoque
 * do Oracle (reaproveitando `features/erp-carteira/server/carteira-winthor.ts`
 * e a camada só-leitura do `erp-sync`), sem que nenhum chamador mude.
 */
export async function fonteComercialDaOrg(
  organizationId: string,
): Promise<FonteComercial> {
  return criarFonteNativa(organizationId);
}
