import type { financeiroRoutes } from "@/app/router/financeiro";
import type { InferRouterOutputs } from "@orpc/server";

// `import type` apaga o import em runtime, então nenhum código de servidor
// (prisma etc.) é incluído no bundle do cliente — só os tipos de saída.
type Outputs = InferRouterOutputs<typeof financeiroRoutes>;

export type FinanceEntry = Outputs["entries"]["list"]["entries"][number];
export type FinanceAccount = Outputs["accounts"]["list"]["accounts"][number];
export type FinanceCategory =
  Outputs["categories"]["list"]["categories"][number];
export type FinanceCostCenter =
  Outputs["costCenters"]["list"]["costCenters"][number];
export type FinanceContact = Outputs["contacts"]["list"]["contacts"][number];
export type FinanceDashboard = Outputs["dashboard"]["get"];
export type FinanceCashflow = Outputs["dashboard"]["cashflow"];

export type EntryType = FinanceEntry["type"];
export type EntryStatus = FinanceEntry["status"];
export type AccountType = FinanceAccount["type"];
export type CategoryType = FinanceCategory["type"];
export type ContactType = "CUSTOMER" | "SUPPLIER" | "BOTH";
