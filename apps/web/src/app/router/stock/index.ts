import { listStock } from "./list";
import { registerEntry } from "./register-entry";
import { registerOutput } from "./register-output";

export const stockRoutes = {
  create: {
    entry: registerEntry,
    output: registerOutput,
  },
  list: listStock,
};
