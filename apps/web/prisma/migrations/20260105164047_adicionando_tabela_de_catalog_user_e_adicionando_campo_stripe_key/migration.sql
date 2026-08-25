-- AlterTable
ALTER TABLE "catalog_settings" ADD COLUMN     "stripe_key" TEXT;

-- CreateTable
CREATE TABLE "catalog_users" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "stripeCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "catalog_users_organizationId_idx" ON "catalog_users"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_users_organizationId_email_key" ON "catalog_users"("organizationId", "email");

-- AddForeignKey
ALTER TABLE "catalog_users" ADD CONSTRAINT "catalog_users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
