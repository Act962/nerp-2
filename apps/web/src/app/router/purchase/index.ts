import { cancelPurchase } from "./cancel";
import { createPurchase } from "./create";
import { getPurchase } from "./get";
import { listPurchases } from "./list";
import { processPurchase } from "./process";
import { quickCreateProduct } from "./quick-create-product";
import { updatePurchase } from "./update";

export const purchaseRoutes = {
  create: createPurchase,
  update: updatePurchase,
  list: listPurchases,
  get: getPurchase,
  // O único que mexe em estoque, custo e financeiro.
  process: processPurchase,
  cancel: cancelPurchase,
  quickCreateProduct,
};
