import { updateCatalogOrderQuote } from "./update-quote";
import { updateCatalogOrderStatus } from "./update-status";

export const catalogOrderRoutes = {
  updateStatus: updateCatalogOrderStatus,
  updateQuote: updateCatalogOrderQuote,
};
