-- CreateEnum
CREATE TYPE "BookItemApproval" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable: envio do book à indústria
ALTER TABLE "books"
  ADD COLUMN "sentAt" TIMESTAMP(3),
  ADD COLUMN "sentById" TEXT,
  ADD COLUMN "sentByName" TEXT;

-- AlterTable: aprovação por página
ALTER TABLE "book_items"
  ADD COLUMN "approvalStatus" "BookItemApproval" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "approvalNote" TEXT,
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "reviewedByName" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "book_items_bookId_approvalStatus_idx" ON "book_items"("bookId", "approvalStatus");
