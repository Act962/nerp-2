-- Adiciona o cargo VENDEDOR ao enum TradeRole (aplicado ao Member em campo).
ALTER TYPE "TradeRole" ADD VALUE IF NOT EXISTS 'VENDEDOR';
