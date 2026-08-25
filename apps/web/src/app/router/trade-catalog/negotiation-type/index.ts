import { createNegotiationType } from "./create";
import { deleteNegotiationType } from "./delete";
import { listNegotiationType } from "./list";
import { updateNegotiationType } from "./update";

export const negotiationTypeRoutes = {
  list: listNegotiationType,
  create: createNegotiationType,
  update: updateNegotiationType,
  delete: deleteNegotiationType,
};
