-- AlterTable
ALTER TABLE "books" ADD COLUMN     "closingLayout" JSONB,
ADD COLUMN     "coverLayout" JSONB;

-- CreateTable
CREATE TABLE "book_cover_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "coverLayout" JSONB NOT NULL,
    "closingLayout" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "book_cover_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "book_cover_templates_organizationId_key" ON "book_cover_templates"("organizationId");

-- AddForeignKey
ALTER TABLE "book_cover_templates" ADD CONSTRAINT "book_cover_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
