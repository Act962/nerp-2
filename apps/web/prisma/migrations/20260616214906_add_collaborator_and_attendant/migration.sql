-- AlterTable
ALTER TABLE "kitchen_orders" ADD COLUMN     "attendantId" TEXT,
ADD COLUMN     "attendantName" TEXT,
ADD COLUMN     "attendantPhoto" TEXT;

-- CreateTable
CREATE TABLE "collaborators" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "photoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collaborators_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "collaborators_organizationId_isActive_idx" ON "collaborators"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "collaborators_organizationId_name_idx" ON "collaborators"("organizationId", "name");

-- AddForeignKey
ALTER TABLE "kitchen_orders" ADD CONSTRAINT "kitchen_orders_attendantId_fkey" FOREIGN KEY ("attendantId") REFERENCES "collaborators"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaborators" ADD CONSTRAINT "collaborators_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
