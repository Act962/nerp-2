import { createMediaModelPhoto } from "./create";
import { deleteMediaModelPhoto } from "./delete";
import { listMediaModelPhotos } from "./list";

export const mediaModelPhotoRoutes = {
  list: listMediaModelPhotos,
  create: createMediaModelPhoto,
  delete: deleteMediaModelPhoto,
};
