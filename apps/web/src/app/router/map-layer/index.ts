import { createMapLayer } from "./create";
import { updateMapLayer } from "./update";
import { deleteMapLayer } from "./delete";
import { reorderMapLayers } from "./reorder";

export const mapLayerRoutes = {
  create: createMapLayer,
  update: updateMapLayer,
  delete: deleteMapLayer,
  reorder: reorderMapLayers,
};
