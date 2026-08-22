import { listCatalogs } from "./list";
import { getCatalog } from "./get";
import { createCatalog } from "./create";
import { updateCatalog } from "./update";
import { deleteCatalog } from "./delete";
import { duplicateCatalog } from "./duplicate";
import { listPromotionalProducts } from "./list-promotional-products";
import { updateProductPrice } from "./update-product-price";
import { listCatalogTemplates } from "./template-list";
import { createCatalogTemplate } from "./template-create";
import { updateCatalogTemplate } from "./template-update";
import { deleteCatalogTemplate } from "./template-delete";
import { listCatalogAssets } from "./asset-list";
import { createCatalogAsset } from "./asset-create";
import { deleteCatalogAsset } from "./asset-delete";
import { listPriceStyles } from "./price-style-list";
import { createPriceStyle } from "./price-style-create";
import { updatePriceStyle } from "./price-style-update";
import { deletePriceStyle } from "./price-style-delete";
import { listCatalogsForSeller } from "./list-for-seller";
import { markCatalogViewed } from "./mark-viewed";
import { unseenCatalogCount } from "./unseen-count";
import { enableCatalogShare } from "./enable-share";
import { disableCatalogShare } from "./disable-share";
import { publicGetCatalog } from "./public-get";
import { matchProductsByName } from "./match-products-by-name";
import { extractOffersFromFile } from "./extract-offers-from-file";
import { searchCatalogProducts } from "./search-products";
import { createOfferProducts } from "./create-offer-products";
import { matchStoresByName } from "./match-stores-by-name";
import { productThumbnails } from "./product-thumbnails";

export const promotionalCatalogRouter = {
  list: listCatalogs,
  get: getCatalog,
  create: createCatalog,
  update: updateCatalog,
  delete: deleteCatalog,
  duplicate: duplicateCatalog,
  listProducts: listPromotionalProducts,
  updateProductPrice,
  listTemplates: listCatalogTemplates,
  createTemplate: createCatalogTemplate,
  updateTemplate: updateCatalogTemplate,
  deleteTemplate: deleteCatalogTemplate,
  listAssets: listCatalogAssets,
  createAsset: createCatalogAsset,
  deleteAsset: deleteCatalogAsset,
  listPriceStyles,
  createPriceStyle,
  updatePriceStyle,
  deletePriceStyle,
  listForSeller: listCatalogsForSeller,
  markViewed: markCatalogViewed,
  unseenCount: unseenCatalogCount,
  enableShare: enableCatalogShare,
  disableShare: disableCatalogShare,
  publicGet: publicGetCatalog,
  matchProductsByName,
  extractOffersFromFile,
  searchProducts: searchCatalogProducts,
  createOfferProducts,
  matchStoresByName,
  productThumbnails,
};
