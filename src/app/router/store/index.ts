import { backfillStoreSlugs } from "./backfill-slugs";
import { createStore } from "./create";
import { listStore } from "./list";
import { getStore } from "./get";
import { updateStore } from "./update";
import { deleteStore } from "./delete";
import { storeOverview } from "./overview";
import { createImport } from "./import/create";
import { getImport } from "./import/get";

export const storeRoutes = {
  list: listStore,
  create: createStore,
  backfillSlugs: backfillStoreSlugs,
  getOne: getStore,
  update: updateStore,
  delete: deleteStore,
  overview: storeOverview,
  import: {
    create: createImport,
    get: getImport,
  },
};
