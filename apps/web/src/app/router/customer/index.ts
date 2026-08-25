import { createCustomer } from "./create";
import { listCustomer } from "./list";
import { getCustomer } from "./get";
import { updateCustomer } from "./update";
import { deleteCustomer } from "./delete";
import { createImport } from "./import/create";
import { getImport } from "./import/get";

export const customerRoutes = {
  list: listCustomer,
  create: createCustomer,
  getOne: getCustomer,
  update: updateCustomer,
  delete: deleteCustomer,
  import: {
    create: createImport,
    get: getImport,
  },
};
