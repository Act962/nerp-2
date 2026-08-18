-- Gondola salva como padrao da rede. Aditivo puro: tabela nova, nada existente muda.
CREATE TABLE "planogram_fixture_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "FixtureKind" NOT NULL DEFAULT 'GONDOLA',
    "widthMm" INTEGER NOT NULL,
    "heightMm" INTEGER NOT NULL,
    "depthMm" INTEGER NOT NULL,
    "baseHeightMm" INTEGER NOT NULL,
    "colorHex" TEXT,
    "moduleCount" INTEGER NOT NULL DEFAULT 1,
    "shelves" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planogram_fixture_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "planogram_fixture_templates_organizationId_name_key" ON "planogram_fixture_templates"("organizationId", "name");
CREATE INDEX "planogram_fixture_templates_organizationId_isDefault_idx" ON "planogram_fixture_templates"("organizationId", "isDefault");

ALTER TABLE "planogram_fixture_templates" ADD CONSTRAINT "planogram_fixture_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
