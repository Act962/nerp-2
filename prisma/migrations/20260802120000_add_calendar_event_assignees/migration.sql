-- CreateTable
CREATE TABLE "calendar_event_assignees" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_event_assignees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calendar_event_assignees_organizationId_idx" ON "calendar_event_assignees"("organizationId");
CREATE INDEX "calendar_event_assignees_memberId_idx" ON "calendar_event_assignees"("memberId");
CREATE UNIQUE INDEX "calendar_event_assignees_eventId_memberId_key" ON "calendar_event_assignees"("eventId", "memberId");

-- AddForeignKey
ALTER TABLE "calendar_event_assignees" ADD CONSTRAINT "calendar_event_assignees_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calendar_event_assignees" ADD CONSTRAINT "calendar_event_assignees_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calendar_event_assignees" ADD CONSTRAINT "calendar_event_assignees_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
