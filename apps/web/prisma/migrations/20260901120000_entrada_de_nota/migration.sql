-- Entrada de nota do fornecedor com múltiplos produtos.
--
-- Os modelos `Purchase`/`PurchaseItem` existem no banco desde
-- `20251204200853_create_erpc_tables` e nunca foram usados por nenhuma linha de
-- código — assim como `stock_movements.purchaseId` e `stock_movements.unitCost`.
-- Esta migration só acrescenta o que faltava para ligá-los.
--
-- Por que cada coluna:
--
-- `organization.lastPurchaseNumber` — contador atômico da numeração, o par do
--   `lastSaleNumber`. Sem ele sobraria `count()+1`, que corre contra o
--   `@@unique([organizationId, purchaseNumber])`.
--
-- `purchases.installments` / `firstDueDate` — a condição de pagamento vem do
--   papel na hora da digitação, não do processamento. Sem persistir, ela some
--   ao salvar o rascunho e reabrir. Não reaproveitamos `expectedDate`: aquilo é
--   data prevista de ENTREGA, outra coisa.
--
-- `purchase_items.newSalePrice` — o preço de venda que o operador ACEITOU para
--   aquele produto. NULL = não mexer no preço. Precisa persistir porque o
--   rascunho é reaberto; senão a precificação seria refeita a cada abertura.
--
-- `purchase_items.sortOrder` — `purchase_items` não tem `createdAt`. Sem ordem
--   explícita as linhas voltam em ordem indefinida (conferir contra o papel
--   fica inviável) e o "último custo" do mesmo produto repetido na nota deixa
--   de ser determinístico.
--
-- `payment_categories.exclude_from_result` — comprar mercadoria é trocar caixa
--   por ativo: o resultado só é atingido na VENDA, via CMV, que
--   `sale-entries.ts` já lança. Sem esta flag não existe como criar um PAYABLE
--   que não bata no DRE: categoria COST ou EXPENSE dobra com o CMV, e sem
--   categoria o lançamento cai em "despesa sem categoria", que também é somada.
--   A conta a pagar continua no fluxo de caixa, que é baseado em `due_date` —
--   o fornecedor vai ser pago de verdade. Serve igual para empréstimo, aporte
--   de sócio e compra de imobilizado.
--
-- `payment_entries.purchase_id` / `purchase_entry_key` — espelho exato do par
--   `sale_id`/`sale_entry_key`: é o único composto que impede reprocessar a
--   nota de duplicar o passivo. FK com SET NULL pelo mesmo motivo da venda —
--   apagar a compra não pode varrer financeiro já conciliado.
--
-- `payment_contacts.supplier_id` — hoje não há vínculo entre `Supplier` e
--   `PaymentContact`. Sem a FK o casamento seria por documento/nome, e renomear
--   o fornecedor forkaria um contato novo, partindo o histórico de contas a
--   pagar em dois. UNIQUE simples porque um fornecedor já pertence a uma única
--   organização; no Postgres NULL não conflita, então contatos avulsos seguem
--   livres.
--
-- Idempotente de ponta a ponta (`IF NOT EXISTS` e blocos que engolem
-- `duplicate_object`), como as outras migrations escritas à mão deste projeto:
-- o banco é compartilhado, o histórico já travou com P3009, e repetir a
-- aplicação precisa ser inofensivo.

-- AlterTable: organization
ALTER TABLE "organization"
  ADD COLUMN IF NOT EXISTS "lastPurchaseNumber" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: purchases
ALTER TABLE "purchases"
  ADD COLUMN IF NOT EXISTS "installments" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "firstDueDate" TIMESTAMP(3);

-- AlterTable: purchase_items
ALTER TABLE "purchase_items"
  ADD COLUMN IF NOT EXISTS "newSalePrice" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "purchase_items_sortOrder_idx"
  ON "purchase_items"("sortOrder");

-- AlterTable: payment_categories
ALTER TABLE "payment_categories"
  ADD COLUMN IF NOT EXISTS "exclude_from_result" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: payment_entries
ALTER TABLE "payment_entries"
  ADD COLUMN IF NOT EXISTS "purchase_id" TEXT,
  ADD COLUMN IF NOT EXISTS "purchase_entry_key" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "payment_entries_purchase_id_purchase_entry_key_key"
  ON "payment_entries"("purchase_id", "purchase_entry_key");

CREATE INDEX IF NOT EXISTS "payment_entries_purchase_id_idx"
  ON "payment_entries"("purchase_id");

DO $$ BEGIN
  ALTER TABLE "payment_entries"
    ADD CONSTRAINT "payment_entries_purchase_id_fkey"
    FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AlterTable: payment_contacts
ALTER TABLE "payment_contacts"
  ADD COLUMN IF NOT EXISTS "supplier_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "payment_contacts_supplier_id_key"
  ON "payment_contacts"("supplier_id");

DO $$ BEGIN
  ALTER TABLE "payment_contacts"
    ADD CONSTRAINT "payment_contacts_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
