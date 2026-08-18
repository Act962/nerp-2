-- Página extra (abertura/divisória/encerramento) não tem loja: só layout.
ALTER TABLE "book_pages" ALTER COLUMN "storeId" DROP NOT NULL;
