-- Vitrine pública PlanoGram (aditiva)
ALTER TABLE "organization" ADD COLUMN "isPublicProfile" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "stores" ADD COLUMN "coverImageKey" TEXT;
