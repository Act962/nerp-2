-- Padrões de catálogo promocional: presets de estilo reutilizáveis por org.
-- Aditivo (nova tabela); thumbnail é a miniatura (data URL JPEG) opcional.
CREATE TABLE IF NOT EXISTS "promotional_catalog_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "thumbnail" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "promotional_catalog_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "promotional_catalog_templates_organizationId_idx"
    ON "promotional_catalog_templates"("organizationId");
