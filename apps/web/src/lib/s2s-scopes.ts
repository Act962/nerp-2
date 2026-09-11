/**
 * Escopos de integração S2S (chave da Órbita/NASA) — o que uma chave PODE
 * chamar. Mesmo modelo de `device-scopes.ts`: FAIL-CLOSED.
 *
 * Até aqui uma chave S2S válida alcançava o router inteiro: só duas
 * procedures pediam escopo (`requireScope("pdv:read")`), e `s2sScopes` era
 * decorativo para as outras 55 entidades — convidar membro, trocar
 * subdomínio, abrir checkout de Stars, tudo com a chave de leitura de PDV.
 *
 * Procedure nova nasce inacessível à chave até ser listada aqui de propósito.
 * O escopo `*` existe para a suíte de integração (que chama qualquer procedure
 * pelo contexto S2S) e para uma integração que o dono da org autorize com
 * "acesso total" na tela de consentimento — nunca é concedido por padrão.
 */

export const S2S_ESCOPO_TOTAL = "*";

/**
 * Path da procedure → escopo exigido. `Map`, não objeto literal, pelo mesmo
 * motivo de `device-scopes.ts`: um path `["constructor"]` cairia no
 * `Object.prototype`.
 */
const ESCOPO_POR_PATH = new Map<string, string>([
  ["mapObject.listSpaces", "pdv:read"],
  ["mapObject.listOpportunities", "pdv:read"],
]);

/** Escopo exigido por uma procedure, ou `null` se ela não é da integração. */
export function escopoS2SExigido(path: readonly string[]): string | null {
  return ESCOPO_POR_PATH.get(path.join(".")) ?? null;
}

export function s2sPodeAcessar(
  path: readonly string[],
  scopes: readonly string[],
): boolean {
  if (scopes.includes(S2S_ESCOPO_TOTAL)) return true;
  const exigido = escopoS2SExigido(path);
  return exigido !== null && scopes.includes(exigido);
}
