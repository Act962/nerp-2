-- CreateTable
CREATE TABLE "organization_join_links" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_join_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_join_links_organizationId_key" ON "organization_join_links"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_join_links_token_key" ON "organization_join_links"("token");

-- CreateIndex
CREATE INDEX "organization_join_links_token_idx" ON "organization_join_links"("token");

-- AddForeignKey
ALTER TABLE "organization_join_links" ADD CONSTRAINT "organization_join_links_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
