import z from "zod";

export const ALL_PERIOD_TYPES = [
  "DAILY",
  "WEEKLY",
  "MONTHLY",
  "BIMONTHLY",
  "QUARTERLY",
  "SEMIANNUAL",
  "ANNUAL",
] as const;

export const periodTypeSchema = z.enum(ALL_PERIOD_TYPES);

export const entryKindSchema = z.enum(["SELLER", "BUCKET"]);

// Qual recorte de venda o ranking conta:
//   INVOICED — só faturado (posicao 'F'), receita conservadora, concilia com o
//              financeiro. É o padrão.
//   PIPELINE — todo pedido não cancelado, igual ao relatório de supervisor do
//              Winthor. Fica ~11% acima do faturado neste cliente.
export const ALL_SALES_MODES = ["INVOICED", "PIPELINE"] as const;
export const salesModeSchema = z.enum(ALL_SALES_MODES);
export type SalesMode = (typeof ALL_SALES_MODES)[number];
