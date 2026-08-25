import { createStoreSector } from "./create";
import { deleteStoreSector } from "./delete";
import { listStoreSector } from "./list";
import { updateStoreSector } from "./update";

export const storeSectorRoutes = {
  list: listStoreSector,
  create: createStoreSector,
  update: updateStoreSector,
  delete: deleteStoreSector,
};
