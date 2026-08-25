-- AlterTable
ALTER TABLE "books" ADD COLUMN     "pageLayout" JSONB,
ADD COLUMN     "pageBackground" JSONB;

-- CreateTable
CREATE TABLE "book_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "supplierId" TEXT,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "coverLayout" JSONB NOT NULL,
    "closingLayout" JSONB NOT NULL,
    "pageLayout" JSONB,
    "coverBackground" JSONB,
    "closingBackground" JSONB,
    "pageBackground" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "book_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "book_templates_organizationId_supplierId_idx" ON "book_templates"("organizationId", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "book_templates_organizationId_supplierId_name_key" ON "book_templates"("organizationId", "supplierId", "name");

-- AddForeignKey
ALTER TABLE "book_templates" ADD CONSTRAINT "book_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_templates" ADD CONSTRAINT "book_templates_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: o padrão de capa que já existia por organização vira o padrão da
-- organização no novo modelo (supplierId NULL), pra ninguém perder o layout
-- salvo. book_cover_templates fica intacto e pode ser removido numa migration
-- futura, depois que este backfill rodar em produção.
INSERT INTO "book_templates" (
    "id", "organizationId", "supplierId", "name", "isDefault",
    "coverLayout", "closingLayout", "coverBackground", "closingBackground",
    "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    "organizationId",
    NULL,
    'Padrão da organização',
    true,
    "coverLayout",
    "closingLayout",
    "coverBackground",
    "closingBackground",
    "createdAt",
    "updatedAt"
FROM "book_cover_templates";
