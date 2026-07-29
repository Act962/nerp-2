-- Novo tipo de exibição TABLE (consulta do Oracle com várias colunas).
-- Sozinho no arquivo de propósito: no Postgres um valor recém-adicionado a um
-- ENUM não pode ser USADO na mesma transação em que foi criado.
ALTER TYPE "DashboardWidgetDisplayType" ADD VALUE 'TABLE';
