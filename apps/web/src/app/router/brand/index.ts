import { createBrand } from "./create";
import { listBrand } from "./list";
import { updateBrand } from "./update";
import { deleteBrand } from "./delete";

export const brandRoutes = {
  list: listBrand,
  create: createBrand,
  update: updateBrand,
  delete: deleteBrand,
};
