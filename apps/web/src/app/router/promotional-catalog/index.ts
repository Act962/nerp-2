import { listCatalogs } from "./list";
import { getCatalog } from "./get";
import { createCatalog } from "./create";
import { updateCatalog } from "./update";
import { deleteCatalog } from "./delete";
import { listPromotionalProducts } from "./list-promotional-products";
import { updateProductPrice } from "./update-product-price";

export const promotionalCatalogRouter = {
  list: listCatalogs,
  get: getCatalog,
  create: createCatalog,
  update: updateCatalog,
  delete: deleteCatalog,
  listProducts: listPromotionalProducts,
  updateProductPrice,
};
