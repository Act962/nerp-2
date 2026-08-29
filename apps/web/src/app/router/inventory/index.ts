import { applyInventoryCount } from "./apply";
import { cancelInventoryCount } from "./cancel";
import { countInventoryItem } from "./count-item";
import { createInventoryCount } from "./create";
import { getInventoryCount } from "./get";
import { listInventoryCounts } from "./list";

export const inventoryRoutes = {
  create: createInventoryCount,
  list: listInventoryCounts,
  get: getInventoryCount,
  countItem: countInventoryItem,
  apply: applyInventoryCount,
  cancel: cancelInventoryCount,
};
