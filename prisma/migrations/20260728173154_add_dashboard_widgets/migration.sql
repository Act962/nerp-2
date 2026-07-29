-- Dashboard personalizável: widgets por membro + métricas manuais por org.
-- Aditivo puro: tabelas e enums novos, nenhuma coluna existente é tocada.

-- CreateEnum
CREATE TYPE "DashboardWidgetDisplayType" AS ENUM ('STAT', 'CHART', 'LIST');
CREATE TYPE "DashboardWidgetChartKind" AS ENUM ('LINE', 'BAR', 'DONUT');

-- CreateTable
CREATE TABLE "dashboard_widgets" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "dataSourceKey" TEXT NOT NULL,
    "displayType" "DashboardWidgetDisplayType" NOT NULL,
    "chartKind" "DashboardWidgetChartKind",
    "options" JSONB,
    "layout" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboard_widgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_manual_metrics" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" DECIMAL(15,2) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'number',
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboard_manual_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dashboard_widgets_memberId_idx" ON "dashboard_widgets"("memberId");

-- CreateIndex
CREATE INDEX "dashboard_manual_metrics_organizationId_idx" ON "dashboard_manual_metrics"("organizationId");

-- AddForeignKey
ALTER TABLE "dashboard_widgets" ADD CONSTRAINT "dashboard_widgets_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_manual_metrics" ADD CONSTRAINT "dashboard_manual_metrics_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_manual_metrics" ADD CONSTRAINT "dashboard_manual_metrics_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
