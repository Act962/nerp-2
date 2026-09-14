import { approvalCheckout } from "./approval-checkout";
import { menuCheckout } from "./menu-checkout";
import { kitchenCheckout } from "./pedidos-checkout";
import { purchase } from "./purchase";
import { statusDoPagamento } from "./status-do-pagamento";
import { purchaseAssas } from "./purchase-assas";

export const checkoutRouter = {
  purchase,
  purchaseAssas,
  kitchenCheckout,
  approvalCheckout,
  menuCheckout,
  statusDoPagamento,
};
