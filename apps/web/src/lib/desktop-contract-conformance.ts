import type { DesktopApi } from "@nerp/api";
import type { AppRouter } from "@/rpc-type";
import type { RouterClient } from "@orpc/server";

/**
 * Guard de conformidade (tempo de compilação): garante que o client REAL do
 * router satisfaz o contrato `DesktopApi` do `@nerp/api` que o app desktop usa.
 *
 * Por que existe: o tipo do `router` é grande demais para o TS serializar num
 * `.d.ts` (TS7056), então o desktop não consegue inferir `RouterClient<AppRouter>`
 * de um pacote — ele declara à mão só a fatia que usa. Este arquivo fecha a
 * brecha: se `device.pairWithCredentials`, `products.list/pull` ou
 * `sales.createFromDevice` mudarem de forma (input/output) sem o contrato ser
 * atualizado, o tipo abaixo deixa de ser `true` e o `check-types` do WEB QUEBRA
 * aqui — nada de drift silencioso entre servidor e desktop. Só tipos, sem runtime.
 *
 * É o análogo, para o contrato oRPC, do `device-enums-parity.test.ts` (que faz o
 * mesmo para os enums espelhados).
 */
type Conforms = RouterClient<AppRouter> extends DesktopApi
  ? true
  : {
      readonly __erro: "DesktopApi divergiu do router real — atualize packages/api/src/contract.ts";
    };

export const _assertDesktopContract: Conforms = true;
