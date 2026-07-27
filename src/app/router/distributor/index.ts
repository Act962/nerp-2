import { createDistributor } from "./create";
import { deleteDistributor } from "./delete";
import { getDistributorRelations } from "./get-relations";
import { listDistributors } from "./list";
import { setDistributorRelations } from "./set-relations";
import { updateDistributor } from "./update";

export const distributorRoutes = {
  list: listDistributors,
  create: createDistributor,
  update: updateDistributor,
  delete: deleteDistributor,
  getRelations: getDistributorRelations,
  setRelations: setDistributorRelations,
};
