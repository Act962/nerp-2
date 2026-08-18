import { getPdvShortcuts } from "./get-shortcuts";
import { getPdvWeighed } from "./get-weighed";
import { updatePdvShortcuts } from "./update-shortcuts";
import { updatePdvWeighed } from "./update-weighed";

export const pdvSettingsRoutes = {
  getShortcuts: getPdvShortcuts,
  updateShortcuts: updatePdvShortcuts,
  getWeighed: getPdvWeighed,
  updateWeighed: updatePdvWeighed,
};
