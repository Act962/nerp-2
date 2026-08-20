-- DRO: classifica a categoria como operacional (padrão) ou não-operacional/
-- financeira. Aditivo e default true: todas as categorias existentes contam
-- como operacionais.
ALTER TABLE "payment_categories"
  ADD COLUMN IF NOT EXISTS "is_operational" BOOLEAN NOT NULL DEFAULT true;
