-- CreateTable
CREATE TABLE "sync_outbox" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sync_outbox_deliveredAt_nextAttemptAt_idx" ON "sync_outbox"("deliveredAt", "nextAttemptAt");
