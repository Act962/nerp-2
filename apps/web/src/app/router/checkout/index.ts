import { approvalCheckout } from "./approval-checkout";
import { orbitaCheckout } from "./orbita-checkout";
import { orbitaStatus } from "./orbita-status";
import { kitchenCheckout } from "./pedidos-checkout";
import { purchase } from "./purchase";
import { purchaseAssas } from "./purchase-assas";

export const checkoutRouter = {
  purchase,
  purchaseAssas,
  kitchenCheckout,
  approvalCheckout,
  orbitaCheckout,
  orbitaStatus,
};
