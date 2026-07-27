import { getBilling } from "./get";
import { setBillingPlan } from "./set-plan";

export const billingRoutes = {
  get: getBilling,
  setPlan: setBillingPlan,
};
