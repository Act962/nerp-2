-- AlterTable: personalização visual do painel (fundo/contorno/cor/fonte).
ALTER TABLE "org_dashboard_panels" ADD COLUMN "appearance" JSONB;
