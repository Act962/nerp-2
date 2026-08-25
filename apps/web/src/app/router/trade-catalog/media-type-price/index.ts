import { deleteMediaTypePrice } from "./delete";
import { listMediaTypePrice } from "./list";
import { upsertMediaTypePrice } from "./upsert";

export const mediaTypePriceRoutes = {
  list: listMediaTypePrice,
  upsert: upsertMediaTypePrice,
  delete: deleteMediaTypePrice,
};
