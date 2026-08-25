-- CreateTable
CREATE TABLE "org_dashboard_boards" (
    "id" TEXT NOT NULL,
    "orgDashboardId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_dashboard_boards_pkey" PRIMARY KEY ("id")
);

-- AlterTable: add boardId to panels
ALTER TABLE "org_dashboard_panels" ADD COLUMN "boardId" TEXT;

-- CreateIndex
CREATE INDEX "org_dashboard_boards_orgDashboardId_idx" ON "org_dashboard_boards"("orgDashboardId");

-- CreateIndex
CREATE INDEX "org_dashboard_panels_boardId_idx" ON "org_dashboard_panels"("boardId");

-- AddForeignKey
ALTER TABLE "org_dashboard_boards" ADD CONSTRAINT "org_dashboard_boards_orgDashboardId_fkey" FOREIGN KEY ("orgDashboardId") REFERENCES "org_dashboards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_dashboard_panels" ADD CONSTRAINT "org_dashboard_panels_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "org_dashboard_boards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
