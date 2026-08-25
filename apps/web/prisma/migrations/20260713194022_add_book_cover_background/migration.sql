-- AlterTable
ALTER TABLE "book_cover_templates" ADD COLUMN     "closingBackground" JSONB,
ADD COLUMN     "coverBackground" JSONB;

-- AlterTable
ALTER TABLE "books" ADD COLUMN     "closingBackground" JSONB,
ADD COLUMN     "coverBackground" JSONB;
