-- Etiquetas: biblioteca de PNGs por organização para arrastar sobre o catálogo.
CREATE TABLE IF NOT EXISTS "catalog_assets" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "catalog_assets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "catalog_assets_organizationId_idx"
    ON "catalog_assets"("organizationId");
