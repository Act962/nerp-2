-- Padrão BASE por indústria: guarda o chrome (fundo/logos/nome da loja) que os
-- novos padrões de foto copiam.
ALTER TABLE "book_page_templates"
ADD COLUMN IF NOT EXISTS "isBase" BOOLEAN NOT NULL DEFAULT false;
