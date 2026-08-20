import { bulkUpdateProducts } from "./bulk-update";
import { createProduct } from "./create";
import { deleteProduct } from "./delete";
import { duplicateProduct } from "./duplicate";
import { findProductByCode } from "./find-by-code";
import { getProduct } from "./get";
import { listProducts } from "./list";
import { matchProductsBySku } from "./match-by-sku";
import { setProductImages } from "./set-images";
import { setProductThumbnail } from "./set-thumbnail";
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
  matchBySku: matchProductsBySku,
  setImages: setProductImages,
  setThumbnail: setProductThumbnail,
  bulkUpdate: bulkUpdateProducts,
  import: {
    create: createImport,
    get: getImport,
  },
};
