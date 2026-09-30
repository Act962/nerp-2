-- Pedido de orçamento: catálogo sem preço no modo Órbita. O cliente manda só
-- a lista; o consultor combina o valor no Órbita, que o devolve ao NERP.
--
-- Aditiva, com IF NOT EXISTS por causa do banco compartilhado.
-- `quoteRequested` diz que a venda nasceu sem valor; `quotedAt`, quando o
-- valor combinado chegou. Venda antiga nasce false/nulo: tinha preço.
ALTER TABLE "sales"
  ADD COLUMN IF NOT EXISTS "quoteRequested" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "quotedAt" TIMESTAMP(3);
