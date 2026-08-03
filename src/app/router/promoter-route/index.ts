import { addRouteStop } from "./add-stop";
import { getMyRoute } from "./get";
import { optimizeRoute } from "./optimize";
import { removeRouteStop } from "./remove-stop";
import { reorderRoute } from "./reorder";
import { listRoutableStores } from "./routable-stores";

export const promoterRouteRoutes = {
  get: getMyRoute,
  routableStores: listRoutableStores,
  addStop: addRouteStop,
  removeStop: removeRouteStop,
  reorder: reorderRoute,
  optimize: optimizeRoute,
};
