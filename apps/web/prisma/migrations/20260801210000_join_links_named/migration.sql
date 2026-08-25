-- DropIndex
DROP INDEX "organization_join_links_organizationId_key";

-- AlterTable: nome obrigatório. Os links existentes recebem um rótulo genérico
-- e o default sai logo em seguida, para novas linhas serem obrigadas a nomear.
ALTER TABLE "organization_join_links" ADD COLUMN "name" TEXT NOT NULL DEFAULT 'Link de convite';
ALTER TABLE "organization_join_links" ALTER COLUMN "name" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "organization_join_links_organizationId_idx" ON "organization_join_links"("organizationId");
