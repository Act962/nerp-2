-- Miniatura do catálogo (data URL JPEG) capturada no autosave, para a lista.
ALTER TABLE "promotional_catalogs"
  ADD COLUMN IF NOT EXISTS "thumbnail" TEXT;
