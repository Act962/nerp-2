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
import { listCatalogsForSeller } from "./list-for-seller";
import { markCatalogViewed } from "./mark-viewed";
import { unseenCatalogCount } from "./unseen-count";

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
  listForSeller: listCatalogsForSeller,
  markViewed: markCatalogViewed,
  unseenCount: unseenCatalogCount,
};
