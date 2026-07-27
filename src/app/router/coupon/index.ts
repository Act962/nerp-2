import { createCoupon } from "./create";
import { deleteCoupon } from "./delete";
import { listCouponsAdmin } from "./list";

export const couponRoutes = {
  create: createCoupon,
  list: listCouponsAdmin,
  delete: deleteCoupon,
};
