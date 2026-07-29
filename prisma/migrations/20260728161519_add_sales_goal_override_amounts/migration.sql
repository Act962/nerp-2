-- Meta geral do mês (período) e meta geral da equipe (branch), digitadas à
-- mão — independentes da soma das metas de vendedor. Aditivo puro: colunas
-- nulas novas, sem risco de quebrar deploy.

ALTER TABLE "sales_goal_periods" ADD COLUMN "overallGoalAmount" DECIMAL(15,2);
ALTER TABLE "sales_goal_branches" ADD COLUMN "goalAmountOverride" DECIMAL(15,2);
