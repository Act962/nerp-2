import { createFloorPlan } from "./create";
import { listFloorPlan } from "./list";
import { getFullFloorPlan } from "./get-full";
import { updateFloorPlan } from "./update";
import { deleteFloorPlan } from "./delete";
import { exportFloorPlanPdf } from "./export-pdf";

export const floorPlanRoutes = {
  list: listFloorPlan,
  create: createFloorPlan,
  getFull: getFullFloorPlan,
  update: updateFloorPlan,
  delete: deleteFloorPlan,
  exportPdf: exportFloorPlanPdf,
};
