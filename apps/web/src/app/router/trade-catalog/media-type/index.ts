import { createMediaType } from "./create";
import { deleteMediaType } from "./delete";
import { listMediaType } from "./list";
import { toggleMediaTypeFavorite } from "./toggle-favorite";
import { updateMediaType } from "./update";

export const mediaTypeRoutes = {
  list: listMediaType,
  create: createMediaType,
  update: updateMediaType,
  delete: deleteMediaType,
  toggleFavorite: toggleMediaTypeFavorite,
};
