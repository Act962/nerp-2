-- Fiscal Fase 3 (specs/fiscal-nfce.md): status da nota rejeitada cujo número
-- foi inutilizado na SEFAZ. Migration própria porque o Postgres não deixa usar
-- um valor de enum na mesma transação que o criou — e a seguinte usa.
ALTER TYPE "FiscalDocumentStatus" ADD VALUE IF NOT EXISTS 'VOIDED';
