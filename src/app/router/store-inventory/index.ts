import { listBatches, upsertBatch } from "./batches";
import { ruptureTasks, setClearance } from "./rupture";

export const storeInventoryRoutes = {
  listBatches,
  upsertBatch,
  ruptureTasks,
  setClearance,
};
