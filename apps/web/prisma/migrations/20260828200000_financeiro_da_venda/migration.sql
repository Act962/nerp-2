-- Liga a venda do PDV ao Financeiro.
--
-- Até aqui os dois mundos não se tocavam: o PDV gravava `sales`/`sale_items` e
-- o Financeiro lia SÓ `payment_entries`. Resultado: nenhuma venda aparecia no
-- DRE, no DRO nem no fluxo de caixa.
--
-- `sale_entry_key` discrimina as linhas de uma mesma venda ("pag-0", "pag-1",
-- "cmv") porque uma venda vira VÁRIOS lançamentos: cada forma de pagamento
-- liquida num momento diferente (dinheiro na hora, crédito no repasse), e o
-- custo da mercadoria é uma linha à parte. Junto com `sale_id`, o índice único
-- torna a gravação idempotente — reprocessar a venda não duplica o financeiro.
--
-- IF NOT EXISTS porque o `migrate deploy` desta base está bloqueado por uma
-- migração falha anterior (P3009) e esta é aplicada à mão.
ALTER TABLE "payment_entries" ADD COLUMN IF NOT EXISTS "sale_id" TEXT;
ALTER TABLE "payment_entries" ADD COLUMN IF NOT EXISTS "sale_entry_key" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "payment_entries_sale_id_sale_entry_key_key"
    ON "payment_entries"("sale_id", "sale_entry_key");
CREATE INDEX IF NOT EXISTS "payment_entries_sale_id_idx"
    ON "payment_entries"("sale_id");

-- SetNull e não Cascade: apagar uma venda não pode varrer o histórico
-- financeiro que já foi conciliado.
DO $$
BEGIN
    ALTER TABLE "payment_entries"
        ADD CONSTRAINT "payment_entries_sale_id_fkey"
        FOREIGN KEY ("sale_id") REFERENCES "sales"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
