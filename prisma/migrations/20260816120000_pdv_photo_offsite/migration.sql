-- Foto do promotor tirada longe do local conhecido da loja escolhida.
-- Aditivo e default false: nenhuma das fotos existentes é marcada.
ALTER TABLE "pdv_photos"
  ADD COLUMN IF NOT EXISTS "offSite" BOOLEAN NOT NULL DEFAULT false;
