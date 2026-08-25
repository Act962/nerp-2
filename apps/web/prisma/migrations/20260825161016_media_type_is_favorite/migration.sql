-- Favorito de tipo de mídia por org (seletor no card de aprovação).
ALTER TABLE "media_types" ADD COLUMN "isFavorite" BOOLEAN NOT NULL DEFAULT false;
