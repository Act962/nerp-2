import { assignSpaceCode } from "./assign-space-code";
import { bulkDeleteMapObjects } from "./bulk-delete";
import { bulkUpsertMapObjects } from "./bulk-upsert";
import { getMapObjectAudit } from "./get-audit";
import { listOpportunities } from "./list-opportunities";
import { listSpaces } from "./list-spaces";
import { updateSpaceParams } from "./update-space-params";

export const mapObjectRoutes = {
  bulkUpsert: bulkUpsertMapObjects,
  bulkDelete: bulkDeleteMapObjects,
  getAudit: getMapObjectAudit,
  assignSpaceCode,
  listSpaces,
  listOpportunities,
  updateSpaceParams,
};
