-- Percentual aproximado de tributos (Lei 12.741/2012) impresso no DANFE NFC-e.
ALTER TABLE "fiscal_configs" ADD COLUMN IF NOT EXISTS "tributos_aproximados_pct" DECIMAL(5,2);
