-- CreateEnum
CREATE TYPE "CancelRequestKind" AS ENUM ('REMOVE_ITEM', 'REDUCE_QTY');
CREATE TYPE "CancelRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- AlterTable
ALTER TABLE "organization" ADD COLUMN "requireCancelAuth" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "member" ADD COLUMN "cancelPinHash" TEXT;

-- CreateTable
CREATE TABLE "cancellation_requests" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cashSessionId" TEXT,
    "requestedById" TEXT NOT NULL,
    "kind" "CancelRequestKind" NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT,
    "token" TEXT NOT NULL,
    "status" "CancelRequestStatus" NOT NULL DEFAULT 'PENDING',
    "pinAttempts" INTEGER NOT NULL DEFAULT 0,
    "approvedById" TEXT,
    "approvedByName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cancellation_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cancellation_requests_token_key" ON "cancellation_requests"("token");
CREATE INDEX "cancellation_requests_organizationId_idx" ON "cancellation_requests"("organizationId");
CREATE INDEX "cancellation_requests_token_idx" ON "cancellation_requests"("token");
CREATE INDEX "cancellation_requests_organizationId_status_idx" ON "cancellation_requests"("organizationId", "status");

-- AddForeignKey
ALTER TABLE "cancellation_requests" ADD CONSTRAINT "cancellation_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cancellation_requests" ADD CONSTRAINT "cancellation_requests_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "cash_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cancellation_requests" ADD CONSTRAINT "cancellation_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cancellation_requests" ADD CONSTRAINT "cancellation_requests_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
