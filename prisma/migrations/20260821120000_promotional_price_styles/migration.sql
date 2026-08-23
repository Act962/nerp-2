-- Estilos de preço (presets do "Padrão de estilos de preços"): "Meus estilos"
-- por organização (organizationId preenchido, scope 'USER') e "Estilos do
-- sistema" globais (organizationId NULL, scope 'SYSTEM'), criados só pelo super
-- usuário. Aditivo (nova tabela).
CREATE TABLE IF NOT EXISTS "promotional_price_styles" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "scope" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "style" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "promotional_price_styles_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "promotional_price_styles_organizationId_idx"
    ON "promotional_price_styles"("organizationId");
