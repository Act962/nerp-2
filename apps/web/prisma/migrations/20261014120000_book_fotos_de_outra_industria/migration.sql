-- Book montado com fotos lançadas em outra indústria (promotor usou a senha
-- errada). Aditiva, com IF NOT EXISTS por causa do banco compartilhado; book
-- existente nasce com null, que é "as fotos são da própria indústria do book".
ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "photoSupplierId" TEXT;

CREATE INDEX IF NOT EXISTS "books_photoSupplierId_idx" ON "books"("photoSupplierId");
