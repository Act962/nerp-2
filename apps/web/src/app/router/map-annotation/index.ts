import { createMapAnnotation } from "./create";
import { listMapAnnotation } from "./list";
import { updateMapAnnotation } from "./update";
import { deleteMapAnnotation } from "./delete";

export const mapAnnotationRoutes = {
  list: listMapAnnotation,
  create: createMapAnnotation,
  update: updateMapAnnotation,
  delete: deleteMapAnnotation,
};
