-- CreateTable
CREATE TABLE "org_dashboard_panels" (
    "id" TEXT NOT NULL,
    "orgDashboardId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "layout" JSONB,
    "templateKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_dashboard_panels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "org_dashboard_panels_orgDashboardId_idx" ON "org_dashboard_panels"("orgDashboardId");

-- AddForeignKey
ALTER TABLE "org_dashboard_panels" ADD CONSTRAINT "org_dashboard_panels_orgDashboardId_fkey" FOREIGN KEY ("orgDashboardId") REFERENCES "org_dashboards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: adiciona `panelId` opcional em `org_dashboard_widgets` — widgets
-- existentes ficam com null (widget "solto" na raiz, compatível com o modo
-- antigo antes dos painéis).
ALTER TABLE "org_dashboard_widgets" ADD COLUMN "panelId" TEXT;

-- CreateIndex
CREATE INDEX "org_dashboard_widgets_panelId_idx" ON "org_dashboard_widgets"("panelId");

-- AddForeignKey
ALTER TABLE "org_dashboard_widgets" ADD CONSTRAINT "org_dashboard_widgets_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "org_dashboard_panels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
