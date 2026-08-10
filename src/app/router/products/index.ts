import { createProduct } from "./create";
import { deleteProduct } from "./delete";
import { duplicateProduct } from "./duplicate";
import { findProductByCode } from "./find-by-code";
import { getProduct } from "./get";
import { listProducts } from "./list";
import { updateProduct } from "./update";
import { createImport } from "./import/create";
import { getImport } from "./import/get";

export const productsRoutes = {
  list: listProducts,
  create: createProduct,
  get: getProduct,
  findByCode: findProductByCode,
  update: updateProduct,
  delete: deleteProduct,
  duplicate: duplicateProduct,
  import: {
    create: createImport,
    get: getImport,
  },
};
