-- CreateTable
CREATE TABLE "dashboard_sales_goals" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "scopeCode" TEXT NOT NULL DEFAULT '',
    "label" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "value" DECIMAL(15,2) NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboard_sales_goals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dashboard_sales_goals_organizationId_year_month_idx" ON "dashboard_sales_goals"("organizationId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_sales_goals_organizationId_scope_scopeCode_year__key" ON "dashboard_sales_goals"("organizationId", "scope", "scopeCode", "year", "month");

-- AddForeignKey
ALTER TABLE "dashboard_sales_goals" ADD CONSTRAINT "dashboard_sales_goals_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_sales_goals" ADD CONSTRAINT "dashboard_sales_goals_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
