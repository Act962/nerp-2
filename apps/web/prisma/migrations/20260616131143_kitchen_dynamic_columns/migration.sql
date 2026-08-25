-- AlterTable
ALTER TABLE "products" ADD COLUMN     "prepTimeMinutes" INTEGER;

-- CreateTable
CREATE TABLE "kitchen_columns" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#64748B',
    "position" INTEGER NOT NULL,
    "wipLimit" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "icon" TEXT,
    "isInitial" BOOLEAN NOT NULL DEFAULT false,
    "showOnTv" BOOLEAN NOT NULL DEFAULT false,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kitchen_columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kitchen_orders" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "tableNumber" TEXT NOT NULL,
    "dishName" TEXT NOT NULL,
    "productId" TEXT,
    "estimatedMinutes" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "columnEnteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "kitchen_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kitchen_columns_organizationId_position_idx" ON "kitchen_columns"("organizationId", "position");

-- CreateIndex
CREATE INDEX "kitchen_columns_organizationId_isActive_idx" ON "kitchen_columns"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "kitchen_orders_organizationId_columnId_idx" ON "kitchen_orders"("organizationId", "columnId");

-- CreateIndex
CREATE INDEX "kitchen_orders_columnId_position_idx" ON "kitchen_orders"("columnId", "position");

-- CreateIndex
CREATE INDEX "kitchen_orders_createdAt_idx" ON "kitchen_orders"("createdAt");

-- AddForeignKey
ALTER TABLE "kitchen_columns" ADD CONSTRAINT "kitchen_columns_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kitchen_orders" ADD CONSTRAINT "kitchen_orders_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kitchen_orders" ADD CONSTRAINT "kitchen_orders_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "kitchen_columns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kitchen_orders" ADD CONSTRAINT "kitchen_orders_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kitchen_orders" ADD CONSTRAINT "kitchen_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
