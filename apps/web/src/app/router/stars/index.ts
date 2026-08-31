import { createCheckout } from "./create-checkout";
import { getBalance } from "./get-balance";
import { listPackages } from "./list-packages";
import { listRules } from "./list-rules";
import { setRule } from "./set-rule";
import { listTransactions } from "./list-transactions";

/**
 * Stars — o crédito pré-pago consumido por mensagem enviada.
 *
 * Não existe procedure que credite: `checkout` só **abre** o pagamento, e quem
 * credita é o webhook do Stripe, depois de conferir a assinatura. Uma porta
 * HTTP que credita direto seria crédito de graça para quem a encontrasse.
 */
export const starsRoutes = {
  balance: getBalance,
  transactions: listTransactions,
  packages: listPackages,
  checkout: createCheckout,
  rules: {
    list: listRules,
    set: setRule,
  },
};
