-- Adiciona modo APPROVAL ao catálogo (pedido aprovado presencialmente no PDV)
ALTER TYPE "CatalogOperationMode" ADD VALUE IF NOT EXISTS 'APPROVAL';

-- Adiciona status PENDING_APPROVAL a Sale (pedido do catálogo aguardando aprovação)
ALTER TYPE "SaleStatus" ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL';
