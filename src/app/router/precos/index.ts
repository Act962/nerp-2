import { listPriceLists } from "./list";
import { createPriceList } from "./create";
import { updatePriceList } from "./update";
import { deletePriceList } from "./delete";
import { listProductPrices } from "./list-product-prices";
import { setProductPrice } from "./set-product-price";
import { deleteProductPrice } from "./delete-product-price";
import { resolveManyPricesProcedure } from "./resolve-many";

export const precosRoutes = {
  list: listPriceLists,
  create: createPriceList,
  update: updatePriceList,
  delete: deletePriceList,
  listProductPrices,
  setProductPrice,
  deleteProductPrice,
  resolveMany: resolveManyPricesProcedure,
};
