import { createSpaceNegotiation } from "./create";
import { deleteSpaceNegotiation } from "./delete";
import { listSpaceNegotiations } from "./list";
import { listExpiringNegotiations } from "./list-expiring";
import { updateSpaceNegotiation } from "./update";

export const spaceNegotiationRoutes = {
  create: createSpaceNegotiation,
  list: listSpaceNegotiations,
  listExpiring: listExpiringNegotiations,
  update: updateSpaceNegotiation,
  delete: deleteSpaceNegotiation,
};
