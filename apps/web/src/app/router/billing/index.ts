import { getBilling } from "./get";
import { precosAvulsos } from "./precos-avulsos";
import { setBillingPlan } from "./set-plan";

export const billingRoutes = {
  get: getBilling,
  setPlan: setBillingPlan,
  /** Faixa de preço por ferramenta, para o comparativo da tela de planos. */
  precosAvulsos,
};
