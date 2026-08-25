import { createPdvPhoto } from "./create";
import { linkPdvPhotoToMapObject } from "./link-map-object";
import { listPdvPhoto } from "./list";
import { pdvPhotoFilterOptions } from "./filter-options";
import { updatePdvPhoto } from "./update";
import { deletePdvPhoto } from "./delete";

export const pdvPhotoRoutes = {
  list: listPdvPhoto,
  create: createPdvPhoto,
  update: updatePdvPhoto,
  delete: deletePdvPhoto,
  linkMapObject: linkPdvPhotoToMapObject,
  filterOptions: pdvPhotoFilterOptions,
};
