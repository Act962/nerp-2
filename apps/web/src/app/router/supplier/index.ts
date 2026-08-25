import { createSupplier } from "./create";
import { listSupplier } from "./list";
import { getSupplier } from "./get";
import { updateSupplier } from "./update";
import { deleteSupplier } from "./delete";
import { createImport } from "./import/create";
import { getImport } from "./import/get";

export const supplierRoutes = {
  list: listSupplier,
  create: createSupplier,
  getOne: getSupplier,
  update: updateSupplier,
  delete: deleteSupplier,
  import: {
    create: createImport,
    get: getImport,
  },
};
