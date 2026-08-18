import { approvalCheckout } from "./approval-checkout";
import { kitchenCheckout } from "./pedidos-checkout";
import { purchase } from "./purchase";
import { purchaseAssas } from "./purchase-assas";

export const checkoutRouter = {
  purchase,
  purchaseAssas,
  kitchenCheckout,
  approvalCheckout,
};
