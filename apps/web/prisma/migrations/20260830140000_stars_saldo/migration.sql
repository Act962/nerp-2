-- Saldo de Stars na organização.
--
-- As tabelas do ledger (`star_transactions`, `star_rules`, `star_packages`,
-- `stars_payments`, `member_star_budgets`) vieram na migration anterior; faltou
-- o saldo em si, que mora na organização porque é lido em toda cobrança e um
-- join a cada mensagem enviada seria desperdício.
--
-- Saldo único, sem separar bônus: o extrato registra de onde cada crédito veio,
-- e duas contas paralelas só se justificariam se alguma tivesse regra de uso
-- diferente.
--
-- Começa em zero e **não bloqueia nada**: sem regra de custo cadastrada, o
-- envio não cobra. A cobrança só entra em vigor quando alguém cadastrar uma
-- `star_rule` com valor maior que zero.
--
-- `IF NOT EXISTS` pelo mesmo motivo das outras: esta base já esteve bloqueada
-- por migração falha (P3009) e as recentes são aplicadas à mão.
ALTER TABLE "organization"
  ADD COLUMN IF NOT EXISTS "stars_balance" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "stars_cycle_start" TIMESTAMP(3);
