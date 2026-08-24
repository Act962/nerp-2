/**
 * Escopos de dispositivo desktop — o que um token de terminal PODE chamar.
 *
 * Sem isto, um bearer de device é uma credencial COMPLETA do usuário pareado
 * sobre todo o router (55 entidades): um caixa comprometido teria o mesmo
 * alcance que o login do gerente. O terminal só precisa de 6 procedures.
 *
 * O modelo é FAIL-CLOSED: `requireDeviceScope` só libera o que está no mapa
 * abaixo. Procedure nova nasce inacessível ao device até ser listada aqui de
 * propósito — o oposto de um opt-in, que esqueceria de proteger o caso novo.
 */

export const DEVICE_SCOPES = ["pdv:sync", "pdv:sales", "pdv:caixa"] as const;

export type DeviceScope = (typeof DEVICE_SCOPES)[number];

/**
 * Escopos concedidos a um terminal novo. Hoje é o conjunto todo (o app usa as
 * três áreas), mas a coluna `Device.scopes` é por device: dá para parear um
 * terminal só-consulta emitindo apenas `pdv:sync`.
 */
export const DEFAULT_DEVICE_SCOPES: DeviceScope[] = [...DEVICE_SCOPES];

/**
 * Path da procedure → escopo exigido. As chaves são o `path` do oRPC
 * (`["products","pull"]` → `"products.pull"`), que a rota HTTP e o
 * `createRouterClient` preenchem sozinhos.
 *
 * `device.pairWithCredentials` NÃO aparece aqui de propósito: é `base` puro
 * (nenhum middleware de auth), então nunca passa por este guard — ele É a
 * autenticação. E `device.pair`/`revoke`/`list` ficam de fora para que um
 * token de terminal não consiga emitir outro token nem se auto-perpetuar.
 *
 * `Map`, não objeto literal: num literal a busca cai no `Object.prototype`, e
 * um path como `["constructor"]` devolveria uma função em vez de `undefined`.
 */
const SCOPE_BY_PATH = new Map<string, DeviceScope>([
  ["products.pull", "pdv:sync"],
  ["products.list", "pdv:sync"],
  ["sales.createFromDevice", "pdv:sales"],
  ["caixa.openFromDevice", "pdv:caixa"],
  ["caixa.movementFromDevice", "pdv:caixa"],
  ["caixa.closeFromDevice", "pdv:caixa"],
]);

/** Escopo exigido por uma procedure, ou `null` se ela não é do desktop. */
export function requiredDeviceScope(
  path: readonly string[],
): DeviceScope | null {
  return SCOPE_BY_PATH.get(path.join(".")) ?? null;
}

/**
 * O device pode chamar esta procedure? Fail-closed em dois pontos: path fora
 * do mapa (procedure não é do desktop) e escopo ausente na coluna do device.
 */
export function deviceCanAccess(
  path: readonly string[],
  scopes: readonly string[],
): boolean {
  const required = requiredDeviceScope(path);
  return required !== null && scopes.includes(required);
}
