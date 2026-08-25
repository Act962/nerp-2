-- CreateEnum
CREATE TYPE "KitchenOrderEventType" AS ENUM ('CREATED', 'MOVED', 'READY', 'DELIVERED', 'ARCHIVED', 'RESTORED');

-- CreateEnum
CREATE TYPE "KitchenOrderActorType" AS ENUM ('USER', 'WAITER', 'SYSTEM');

-- CreateTable
CREATE TABLE "kitchen_order_events" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orderId" TEXT,
    "type" "KitchenOrderEventType" NOT NULL,
    "tableNumber" TEXT NOT NULL,
    "dishName" TEXT NOT NULL,
    "fromColumnId" TEXT,
    "fromColumnName" TEXT,
    "toColumnId" TEXT,
    "toColumnName" TEXT,
    "attendantId" TEXT,
    "attendantName" TEXT,
    "attendantPhoto" TEXT,
    "actorType" "KitchenOrderActorType" NOT NULL,
    "actorUserId" TEXT,
    "actorCollaboratorId" TEXT,
    "actorName" TEXT NOT NULL,
    "actorPhotoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kitchen_order_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kitchen_order_events_organizationId_createdAt_idx" ON "kitchen_order_events"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "kitchen_order_events_orderId_createdAt_idx" ON "kitchen_order_events"("orderId", "createdAt");

-- AddForeignKey
ALTER TABLE "kitchen_order_events" ADD CONSTRAINT "kitchen_order_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kitchen_order_events" ADD CONSTRAINT "kitchen_order_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "kitchen_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kitchen_order_events" ADD CONSTRAINT "kitchen_order_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kitchen_order_events" ADD CONSTRAINT "kitchen_order_events_actorCollaboratorId_fkey" FOREIGN KEY ("actorCollaboratorId") REFERENCES "collaborators"("id") ON DELETE SET NULL ON UPDATE CASCADE;
