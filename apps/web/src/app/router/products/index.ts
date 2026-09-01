import { bulkUpdateProducts } from "./bulk-update";
import { createProduct } from "./create";
import { deleteProduct } from "./delete";
import { duplicateProduct } from "./duplicate";
import { findProductByCode } from "./find-by-code";
import { getProduct } from "./get";
import { productGapsSummary } from "./gaps-summary";
import { listProducts } from "./list";
import { pullProducts } from "./pull";
import { matchProductsBySku } from "./match-by-sku";
import { removeProductBackground } from "./remove-background";
import { searchProductImages } from "./search-images";
import { searchProductsForPdv } from "./search-pdv";
import { setProductImages } from "./set-images";
import { setProductThumbnail } from "./set-thumbnail";
import { setProductThumbnailFromUrl } from "./set-thumbnail-from-url";
import { setProductUnit } from "./set-unit";
import { updateProduct } from "./update";
import { createImport } from "./import/create";
import { getImport } from "./import/get";

export const productsRoutes = {
  gapsSummary: productGapsSummary,
  list: listProducts,
  pull: pullProducts,
  create: createProduct,
  get: getProduct,
  findByCode: findProductByCode,
  searchPdv: searchProductsForPdv,
  update: updateProduct,
  delete: deleteProduct,
  duplicate: duplicateProduct,
  matchBySku: matchProductsBySku,
  setImages: setProductImages,
  setThumbnail: setProductThumbnail,
  setThumbnailFromUrl: setProductThumbnailFromUrl,
  setUnit: setProductUnit,
  searchImages: searchProductImages,
  removeBackground: removeProductBackground,
  bulkUpdate: bulkUpdateProducts,
  import: {
    create: createImport,
    get: getImport,
  },
};
