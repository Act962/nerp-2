import { listCollaborators } from "./list";
import { createCollaborator } from "./create";
import { updateCollaborator } from "./update";
import { deleteCollaborator } from "./delete";

export const collaboratorRoutes = {
  list: listCollaborators,
  create: createCollaborator,
  update: updateCollaborator,
  delete: deleteCollaborator,
};
