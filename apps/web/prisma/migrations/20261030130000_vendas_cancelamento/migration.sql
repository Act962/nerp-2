-- Cancelamento de venda concluída (specs/vendas-cancelamento.md): movimento de
-- caixa de estorno e quem/por que cancelou. Idempotente.
ALTER TYPE "CashMovementType" ADD VALUE IF NOT EXISTS 'ESTORNO';

ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "cancelReason" TEXT;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "cancelledById" TEXT;
