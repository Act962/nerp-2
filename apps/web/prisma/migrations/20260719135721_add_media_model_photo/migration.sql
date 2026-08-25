-- CreateTable
CREATE TABLE "media_model_photos" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "imageKey" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_model_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_model_photos_code_idx" ON "media_model_photos"("code");
