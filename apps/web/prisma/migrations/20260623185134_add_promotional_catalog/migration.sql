-- CreateTable
CREATE TABLE "promotional_catalogs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotional_catalogs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "promotional_catalogs_organizationId_idx" ON "promotional_catalogs"("organizationId");

-- AddForeignKey
ALTER TABLE "promotional_catalogs" ADD CONSTRAINT "promotional_catalogs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotional_catalogs" ADD CONSTRAINT "promotional_catalogs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
