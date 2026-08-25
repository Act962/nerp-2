import { createTradeCatalog } from "./create";
import { deleteTradeCatalog } from "./delete";
import { deleteTradeCatalogPage } from "./delete-page";
import { generateTradeCatalogDocPdf } from "./generate";
import { generateTradeCatalogPages } from "./generate-pages";
import { getTradeCatalog } from "./get";
import { listTradeCatalog } from "./list";
import { publicGetTradeCatalog } from "./public-get";
import { reorderTradeCatalogPages } from "./reorder-pages";
import { updateTradeCatalog } from "./update";
import { updateTradeCatalogCoverLayout } from "./update-cover-layout";
import { updateTradeCatalogPage } from "./update-page";

export const tradeCatalogDocRoutes = {
  list: listTradeCatalog,
  create: createTradeCatalog,
  getOne: getTradeCatalog,
  update: updateTradeCatalog,
  delete: deleteTradeCatalog,
  updateCoverLayout: updateTradeCatalogCoverLayout,
  generatePages: generateTradeCatalogPages,
  updatePage: updateTradeCatalogPage,
  reorderPages: reorderTradeCatalogPages,
  deletePage: deleteTradeCatalogPage,
  generate: generateTradeCatalogDocPdf,
  publicGet: publicGetTradeCatalog,
};
