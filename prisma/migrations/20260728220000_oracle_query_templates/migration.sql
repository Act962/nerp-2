-- Consultas salvas como modelo reutilizável, compartilhadas na organização.
CREATE TABLE "oracle_query_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "config" JSONB NOT NULL,
    "displayType" "DashboardWidgetDisplayType" NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oracle_query_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "oracle_query_templates_organizationId_name_key"
    ON "oracle_query_templates"("organizationId", "name");

CREATE INDEX "oracle_query_templates_organizationId_idx"
    ON "oracle_query_templates"("organizationId");

ALTER TABLE "oracle_query_templates"
    ADD CONSTRAINT "oracle_query_templates_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "oracle_query_templates"
    ADD CONSTRAINT "oracle_query_templates_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "member"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
