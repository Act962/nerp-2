-- AlterTable: layout próprio por página, sobrescrevendo o do book quando preenchido
ALTER TABLE "book_items" ADD COLUMN     "pageLayout" JSONB,
ADD COLUMN     "pageBackground" JSONB;

-- CreateTable
CREATE TABLE "book_page_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "supplierId" TEXT,
    "name" TEXT NOT NULL,
    "layout" JSONB NOT NULL,
    "background" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "book_page_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "book_page_templates_organizationId_supplierId_idx" ON "book_page_templates"("organizationId", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "book_page_templates_organizationId_supplierId_name_key" ON "book_page_templates"("organizationId", "supplierId", "name");

-- AddForeignKey
ALTER TABLE "book_page_templates" ADD CONSTRAINT "book_page_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_page_templates" ADD CONSTRAINT "book_page_templates_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
