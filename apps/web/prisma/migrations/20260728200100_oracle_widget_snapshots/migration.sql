-- Resultado materializado das consultas customizadas ao Oracle: renderizar o
-- dashboard lê daqui, nunca do ERP do cliente.
CREATE TABLE "oracle_widget_snapshots" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "value" JSONB,
    "error" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oracle_widget_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "oracle_widget_snapshots_organizationId_fingerprint_key"
    ON "oracle_widget_snapshots"("organizationId", "fingerprint");

CREATE INDEX "oracle_widget_snapshots_organizationId_idx"
    ON "oracle_widget_snapshots"("organizationId");

ALTER TABLE "oracle_widget_snapshots"
    ADD CONSTRAINT "oracle_widget_snapshots_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
