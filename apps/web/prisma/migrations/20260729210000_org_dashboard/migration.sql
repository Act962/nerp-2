-- CreateTable
CREATE TABLE "org_dashboards" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Dashboard da organização',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "shareToken" TEXT,
    "publicName" TEXT,
    "publicVisibleWidgetIds" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "org_dashboards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "org_dashboards_organizationId_key" ON "org_dashboards"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "org_dashboards_shareToken_key" ON "org_dashboards"("shareToken");

-- CreateIndex
CREATE INDEX "org_dashboards_shareToken_idx" ON "org_dashboards"("shareToken");

-- AddForeignKey
ALTER TABLE "org_dashboards" ADD CONSTRAINT "org_dashboards_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_dashboards" ADD CONSTRAINT "org_dashboards_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "org_dashboard_widgets" (
    "id" TEXT NOT NULL,
    "orgDashboardId" TEXT NOT NULL,
    "dataSourceKey" TEXT NOT NULL,
    "title" TEXT,
    "displayType" "DashboardWidgetDisplayType" NOT NULL,
    "chartKind" "DashboardWidgetChartKind",
    "color" TEXT,
    "icon" TEXT,
    "options" JSONB,
    "layout" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_dashboard_widgets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "org_dashboard_widgets_orgDashboardId_idx" ON "org_dashboard_widgets"("orgDashboardId");

-- CreateIndex
CREATE INDEX "org_dashboard_widgets_parentId_idx" ON "org_dashboard_widgets"("parentId");

-- AddForeignKey
ALTER TABLE "org_dashboard_widgets" ADD CONSTRAINT "org_dashboard_widgets_orgDashboardId_fkey" FOREIGN KEY ("orgDashboardId") REFERENCES "org_dashboards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_dashboard_widgets" ADD CONSTRAINT "org_dashboard_widgets_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "org_dashboard_widgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "org_dashboard_member_permissions" (
    "memberId" TEXT NOT NULL,
    "orgDashboardWidgetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_dashboard_member_permissions_pkey" PRIMARY KEY ("memberId","orgDashboardWidgetId")
);

-- CreateIndex
CREATE INDEX "org_dashboard_member_permissions_memberId_idx" ON "org_dashboard_member_permissions"("memberId");

-- CreateIndex
CREATE INDEX "org_dashboard_member_permissions_orgDashboardWidgetId_idx" ON "org_dashboard_member_permissions"("orgDashboardWidgetId");

-- AddForeignKey
ALTER TABLE "org_dashboard_member_permissions" ADD CONSTRAINT "org_dashboard_member_permissions_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_dashboard_member_permissions" ADD CONSTRAINT "org_dashboard_member_permissions_orgDashboardWidgetId_fkey" FOREIGN KEY ("orgDashboardWidgetId") REFERENCES "org_dashboard_widgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
