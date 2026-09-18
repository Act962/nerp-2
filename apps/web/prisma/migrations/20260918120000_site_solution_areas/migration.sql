-- As áreas da empresa que organizam o painel de Soluções (Comercial,
-- Financeiro, RH…) e a relação N:N com os itens do menu.
--
-- Global, sem `organization_id`, como todas as `site_*`: o site é um só.
-- Aditiva: nada é removido, então uma base já migrada não perde dado.
CREATE TABLE IF NOT EXISTS "site_solution_areas" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "iconKey" TEXT,
    "iconImage" TEXT,
    "color" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_solution_areas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "site_solution_areas_slug_key" ON "site_solution_areas"("slug");
CREATE INDEX IF NOT EXISTS "site_solution_areas_visible_position_idx" ON "site_solution_areas"("visible", "position");

-- A qual área cada solução pertence. Chave composta idempotente (o seed faz
-- upsert por ela) e cascade nos dois lados: apagar a área ou o item leva junto
-- o vínculo, nunca deixa uma linha órfã.
CREATE TABLE IF NOT EXISTS "site_menu_item_areas" (
    "menuItemId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_menu_item_areas_pkey" PRIMARY KEY ("menuItemId", "areaId")
);

CREATE INDEX IF NOT EXISTS "site_menu_item_areas_areaId_position_idx" ON "site_menu_item_areas"("areaId", "position");

ALTER TABLE "site_menu_item_areas" ADD CONSTRAINT "site_menu_item_areas_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "site_menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "site_menu_item_areas" ADD CONSTRAINT "site_menu_item_areas_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "site_solution_areas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
