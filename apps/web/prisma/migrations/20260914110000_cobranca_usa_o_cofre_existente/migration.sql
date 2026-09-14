-- Correção da migration anterior: a credencial do gateway não ganha tabela.
--
-- `20260914100000` chegou a criar `payment_gateway_config`. Ao construir a tela
-- ficou claro que `financial_integrations` já é exatamente isso — cofre por
-- organização, AES-256-GCM, com `environment` e formulário de instalação — e
-- que um segundo lugar para guardar chave é um segundo lugar de onde ela pode
-- vazar. Migration aplicada é imutável, então a correção vem aqui.
--
-- Seguro de rodar: `charges` está vazia e `payment_gateway_config` nunca foi
-- lida por código nenhum (o `resolverGateway` sempre leu `financial_integrations`).

ALTER TABLE "charges" DROP CONSTRAINT IF EXISTS "charges_configId_fkey";

DO $$
BEGIN
  ALTER TABLE "charges" RENAME COLUMN "configId" TO "integrationId";
EXCEPTION
  WHEN undefined_column THEN NULL; -- já renomeada
  WHEN duplicate_column THEN NULL;
END $$;

ALTER TABLE "charges" ADD COLUMN IF NOT EXISTS "integrationId" TEXT;

DO $$
BEGIN
  ALTER TABLE "charges"
    ADD CONSTRAINT "charges_integrationId_fkey"
    FOREIGN KEY ("integrationId") REFERENCES "financial_integrations"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DROP TABLE IF EXISTS "payment_gateway_config";
