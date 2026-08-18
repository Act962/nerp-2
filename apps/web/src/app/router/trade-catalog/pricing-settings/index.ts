import { getTradePricingSettings } from "./get";
import { updateTradePricingSettings } from "./update";

export const tradePricingSettingsRoutes = {
  get: getTradePricingSettings,
  update: updateTradePricingSettings,
};
