-- CreateEnum
CREATE TYPE "SalesGoalPeriodType" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL');

-- CreateEnum
CREATE TYPE "SalesGoalEntryKind" AS ENUM ('SELLER', 'BUCKET');

-- CreateEnum
CREATE TYPE "SalesGoalRankingTheme" AS ENUM ('GAMING', 'LIGHT', 'DARK', 'GALAXY');

-- CreateTable
CREATE TABLE "sales_goal_periods" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "periodType" "SalesGoalPeriodType" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "label" TEXT,
    "sourceFileName" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_goal_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_goal_branches" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_goal_branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_goal_entries" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "externalCode" TEXT NOT NULL,
    "goalName" TEXT NOT NULL,
    "sellerName" TEXT NOT NULL,
    "entryKind" "SalesGoalEntryKind" NOT NULL DEFAULT 'SELLER',
    "goalAmount" DECIMAL(15,2) NOT NULL,
    "achievedAmount" DECIMAL(15,2),
    "memberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_goal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_goal_ranking_settings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL DEFAULT 'Ranking de Equipes',
    "theme" "SalesGoalRankingTheme" NOT NULL DEFAULT 'GAMING',
    "activePeriodTypes" "SalesGoalPeriodType"[],
    "soundEnabled" BOOLEAN NOT NULL DEFAULT true,
    "scoreSoundUrl" TEXT,
    "overtakeSoundUrl" TEXT,
    "victorySoundUrl" TEXT,
    "soundVolume" DOUBLE PRECISION NOT NULL DEFAULT 0.6,
    "prizes" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_goal_ranking_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sales_goal_periods_organizationId_idx" ON "sales_goal_periods"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_goal_periods_organizationId_periodType_periodStart_key" ON "sales_goal_periods"("organizationId", "periodType", "periodStart");

-- CreateIndex
CREATE INDEX "sales_goal_branches_periodId_idx" ON "sales_goal_branches"("periodId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_goal_branches_periodId_name_key" ON "sales_goal_branches"("periodId", "name");

-- CreateIndex
CREATE INDEX "sales_goal_entries_branchId_idx" ON "sales_goal_entries"("branchId");

-- CreateIndex
CREATE INDEX "sales_goal_entries_memberId_idx" ON "sales_goal_entries"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_goal_entries_branchId_externalCode_key" ON "sales_goal_entries"("branchId", "externalCode");

-- CreateIndex
CREATE UNIQUE INDEX "sales_goal_ranking_settings_organizationId_key" ON "sales_goal_ranking_settings"("organizationId");

-- AddForeignKey
ALTER TABLE "sales_goal_periods" ADD CONSTRAINT "sales_goal_periods_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_goal_branches" ADD CONSTRAINT "sales_goal_branches_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "sales_goal_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_goal_entries" ADD CONSTRAINT "sales_goal_entries_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "sales_goal_branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_goal_entries" ADD CONSTRAINT "sales_goal_entries_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_goal_ranking_settings" ADD CONSTRAINT "sales_goal_ranking_settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
