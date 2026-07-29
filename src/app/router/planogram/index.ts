import { bulkSavePlanogram } from "./bulk-save";
import { createPlanogram } from "./create";
import { deletePlanogram } from "./delete";
import {
  deleteFixtureTemplate,
  listFixtureTemplates,
  saveFixtureTemplate,
} from "./fixture-templates";
import { getPlanogramFull } from "./get-full";
import { listPlanograms } from "./list";
import { normalizeProductPhoto } from "./normalize-product-photo";
import { recutProductPhoto } from "./recut-product-photo";
import { searchPlanogramProducts } from "./search-products";
import { updatePlanogram } from "./update";
import { updateProductDimensions } from "./update-product-dimensions";
import { createPlanogramVersion, listPlanogramVersions } from "./versions";

export const planogramRoutes = {
  list: listPlanograms,
  create: createPlanogram,
  getFull: getPlanogramFull,
  update: updatePlanogram,
  delete: deletePlanogram,
  bulkSave: bulkSavePlanogram,
  searchProducts: searchPlanogramProducts,
  updateProductDimensions: updateProductDimensions,
  normalizeProductPhoto: normalizeProductPhoto,
  recutProductPhoto: recutProductPhoto,
  createVersion: createPlanogramVersion,
  listVersions: listPlanogramVersions,
  listFixtureTemplates: listFixtureTemplates,
  saveFixtureTemplate: saveFixtureTemplate,
  deleteFixtureTemplate: deleteFixtureTemplate,
};
