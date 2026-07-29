-- Ícone opcional (chave validada em código, mesmo padrão de "color") e novo
-- displayType MAP (widgets de mapa de região).
ALTER TABLE "dashboard_widgets" ADD COLUMN "icon" TEXT;
ALTER TYPE "DashboardWidgetDisplayType" ADD VALUE 'MAP';
