import { listStock } from "./list";
import { registerAdjustment } from "./register-adjustment";
import { registerEntry } from "./register-entry";
import { registerOutput } from "./register-output";

export const stockRoutes = {
  create: {
    entry: registerEntry,
    output: registerOutput,
    adjustment: registerAdjustment,
  },
  list: listStock,
};
