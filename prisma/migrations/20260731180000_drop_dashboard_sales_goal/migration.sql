-- Meta passa a ter fonte ÚNICA: o período do ranking (sales_goal_periods →
-- sales_goal_branches → sales_goal_entries), que já tem importação de planilha,
-- histórico e o lado "vendido". Esta tabela era uma segunda verdade sobre a
-- mesma informação, alimentada por digitação manual, e os widgets do Oracle
-- agora leem uma PROJEÇÃO daquela fonte (list-sales-goals.ts).

-- DropTable
DROP TABLE "dashboard_sales_goals";
