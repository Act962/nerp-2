import { approvePending } from "./approve-pending";
import { createSale } from "./create";
import { createSaleFromDevice } from "./create-from-device";
import { getSale } from "./get";
import { listSales } from "./list";
import { listSalesByCustomer } from "./list-by-customer";
import { listPendingApproval } from "./list-pending-approval";

export const SalesRoutes = {
  list: listSales,
  get: getSale,
  create: createSale,
  createFromDevice: createSaleFromDevice,
  listByCustomer: listSalesByCustomer,
  listPendingApproval,
  approvePending,
};
