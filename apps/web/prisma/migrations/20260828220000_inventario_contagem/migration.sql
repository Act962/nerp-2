-- Sessão de contagem de inventário, retomável e cega.
--
-- Contar uma loja não cabe numa sentada: o operador conta um corredor, para, e
-- retoma depois — de outro aparelho, se precisar. A sessão vive no servidor
-- justamente para a contagem não morrer com a aba.
--
-- `system_quantity` guarda o saldo do sistema CONGELADO no instante da
-- contagem. Sem congelar, a divergência mudaria sozinha quando alguém vendesse
-- o item durante o inventário, e o relatório mentiria sobre o que foi
-- observado no corredor.
--
-- IF NOT EXISTS porque o `migrate deploy` desta base está bloqueado por uma
-- migração falha anterior (P3009) e esta é aplicada à mão.
DO $$ BEGIN
  CREATE TYPE "InventoryCountStatus" AS ENUM ('OPEN', 'APPLIED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "inventory_counts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "InventoryCountStatus" NOT NULL DEFAULT 'OPEN',
    "blind" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdById" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_counts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "inventory_count_items" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "countId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "countedQuantity" DECIMAL(10,3) NOT NULL,
    "systemQuantity" DECIMAL(10,3) NOT NULL,
    "countedById" TEXT,
    "countedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_count_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "inventory_counts_organizationId_status_idx"
    ON "inventory_counts"("organizationId", "status");
-- Recontar o mesmo produto ATUALIZA a linha: é observação nova, não segunda
-- contagem competindo com a primeira.
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_count_items_countId_productId_key"
    ON "inventory_count_items"("countId", "productId");
CREATE INDEX IF NOT EXISTS "inventory_count_items_organizationId_idx"
    ON "inventory_count_items"("organizationId");
CREATE INDEX IF NOT EXISTS "inventory_count_items_countId_idx"
    ON "inventory_count_items"("countId");

DO $$ BEGIN
  ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "inventory_count_items" ADD CONSTRAINT "inventory_count_items_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "inventory_count_items" ADD CONSTRAINT "inventory_count_items_countId_fkey"
    FOREIGN KEY ("countId") REFERENCES "inventory_counts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "inventory_count_items" ADD CONSTRAINT "inventory_count_items_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "inventory_count_items" ADD CONSTRAINT "inventory_count_items_countedById_fkey"
    FOREIGN KEY ("countedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
