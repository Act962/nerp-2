-- CreateEnum
CREATE TYPE "CalendarEventType" AS ENUM ('ACAO_PDV', 'CAMPANHA', 'VISITA', 'TREINAMENTO', 'REUNIAO', 'LANCAMENTO', 'OUTRO');
CREATE TYPE "CalendarEventStatus" AS ENUM ('PLANEJADO', 'EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO');
CREATE TYPE "CalendarVisibility" AS ENUM ('ORG', 'LINKED');

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "CalendarEventType" NOT NULL DEFAULT 'ACAO_PDV',
    "status" "CalendarEventStatus" NOT NULL DEFAULT 'PLANEJADO',
    "visibility" "CalendarVisibility" NOT NULL DEFAULT 'ORG',
    "color" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "isAllDay" BOOLEAN NOT NULL DEFAULT true,
    "location" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_event_stores" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_event_stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_event_suppliers" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_event_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_checklist_items" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_checklist_completions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "storeId" TEXT,
    "note" TEXT,
    "doneAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_checklist_completions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_notes" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "color" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "isAllDay" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calendar_events_organizationId_startsAt_endsAt_idx" ON "calendar_events"("organizationId", "startsAt", "endsAt");
CREATE INDEX "calendar_events_createdById_idx" ON "calendar_events"("createdById");

CREATE INDEX "calendar_event_stores_organizationId_idx" ON "calendar_event_stores"("organizationId");
CREATE INDEX "calendar_event_stores_storeId_idx" ON "calendar_event_stores"("storeId");
CREATE UNIQUE INDEX "calendar_event_stores_eventId_storeId_key" ON "calendar_event_stores"("eventId", "storeId");

CREATE INDEX "calendar_event_suppliers_organizationId_idx" ON "calendar_event_suppliers"("organizationId");
CREATE INDEX "calendar_event_suppliers_supplierId_idx" ON "calendar_event_suppliers"("supplierId");
CREATE UNIQUE INDEX "calendar_event_suppliers_eventId_supplierId_key" ON "calendar_event_suppliers"("eventId", "supplierId");

CREATE INDEX "calendar_checklist_items_eventId_position_idx" ON "calendar_checklist_items"("eventId", "position");
CREATE INDEX "calendar_checklist_items_organizationId_idx" ON "calendar_checklist_items"("organizationId");

CREATE INDEX "calendar_checklist_completions_organizationId_memberId_idx" ON "calendar_checklist_completions"("organizationId", "memberId");
CREATE INDEX "calendar_checklist_completions_itemId_idx" ON "calendar_checklist_completions"("itemId");
CREATE INDEX "calendar_checklist_completions_storeId_idx" ON "calendar_checklist_completions"("storeId");
CREATE UNIQUE INDEX "calendar_checklist_completions_itemId_memberId_storeId_key" ON "calendar_checklist_completions"("itemId", "memberId", "storeId");

CREATE INDEX "calendar_notes_organizationId_memberId_startsAt_idx" ON "calendar_notes"("organizationId", "memberId", "startsAt");

-- CreateIndex (parcial — o Prisma não consegue expressar)
-- No Postgres NULL é distinto de NULL num UNIQUE, então o índice único acima
-- NÃO impede duplicata quando "storeId" é nulo (evento sem loja alvo). Sem
-- isto, o mesmo promotor conseguiria marcar o mesmo item várias vezes.
CREATE UNIQUE INDEX "calendar_checklist_completions_item_member_nostore_key"
  ON "calendar_checklist_completions" ("itemId", "memberId")
  WHERE "storeId" IS NULL;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "calendar_event_stores" ADD CONSTRAINT "calendar_event_stores_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calendar_event_stores" ADD CONSTRAINT "calendar_event_stores_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calendar_event_stores" ADD CONSTRAINT "calendar_event_stores_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "calendar_event_suppliers" ADD CONSTRAINT "calendar_event_suppliers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calendar_event_suppliers" ADD CONSTRAINT "calendar_event_suppliers_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calendar_event_suppliers" ADD CONSTRAINT "calendar_event_suppliers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "calendar_checklist_items" ADD CONSTRAINT "calendar_checklist_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calendar_checklist_items" ADD CONSTRAINT "calendar_checklist_items_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "calendar_checklist_completions" ADD CONSTRAINT "calendar_checklist_completions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calendar_checklist_completions" ADD CONSTRAINT "calendar_checklist_completions_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "calendar_checklist_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calendar_checklist_completions" ADD CONSTRAINT "calendar_checklist_completions_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calendar_checklist_completions" ADD CONSTRAINT "calendar_checklist_completions_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "calendar_notes" ADD CONSTRAINT "calendar_notes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calendar_notes" ADD CONSTRAINT "calendar_notes_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
