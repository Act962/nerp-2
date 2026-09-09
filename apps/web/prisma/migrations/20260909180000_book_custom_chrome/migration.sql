-- Capa/página final próprias do book. Sem esta marca o padrão COVER/CLOSING da
-- indústria vence sempre, e a capa editada dentro do book era gravada num campo
-- que nenhum leitor consultava.
ALTER TABLE "books" ADD COLUMN "customChrome" BOOLEAN NOT NULL DEFAULT false;
