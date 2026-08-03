-- CreateTable
CREATE TABLE "calendar_note_tasks" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_note_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calendar_note_tasks_noteId_position_idx" ON "calendar_note_tasks"("noteId", "position");
CREATE INDEX "calendar_note_tasks_organizationId_idx" ON "calendar_note_tasks"("organizationId");

-- AddForeignKey
ALTER TABLE "calendar_note_tasks" ADD CONSTRAINT "calendar_note_tasks_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calendar_note_tasks" ADD CONSTRAINT "calendar_note_tasks_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "calendar_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
