-- ★ passa a aceitar fração.
--
-- O preço por bloco de tokens não cabe em inteiro: 1 ★ por 1.000 tokens é caro
-- demais e 0 desliga a cobrança, então não havia como cobrar o Astro por um
-- valor justo. Duas casas decimais bastam — abaixo de 0,01 ★ a conta vira
-- ruído.
--
-- A conversão de INTEGER para NUMERIC não perde dado: todo inteiro cabe em
-- numeric(12,2). O que ela NÃO é: reversível sem escolher o que fazer com as
-- casas decimais que passarem a existir.
ALTER TABLE "star_rules"        ALTER COLUMN "stars"               TYPE NUMERIC(12,2);
ALTER TABLE "organization"      ALTER COLUMN "stars_balance"       TYPE NUMERIC(12,2);
ALTER TABLE "organization"      ALTER COLUMN "stars_used_in_cycle" TYPE NUMERIC(12,2);
ALTER TABLE "star_transactions" ALTER COLUMN "amount"              TYPE NUMERIC(12,2);
ALTER TABLE "star_transactions" ALTER COLUMN "balance_after"       TYPE NUMERIC(12,2);
ALTER TABLE "astro_acoes"       ALTER COLUMN "stars_cobradas"      TYPE NUMERIC(12,2);
