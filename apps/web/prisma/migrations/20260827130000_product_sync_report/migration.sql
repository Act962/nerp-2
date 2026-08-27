-- Resultado do último sync de CADASTRO de produtos, guardado na conexão.
--
-- Fica aqui e não numa tabela de histórico porque o que importa é sempre a
-- última passada: quantos casaram, quantos ficariam de fora e quantos seriam
-- criados. Guardar a série inteira só teria valor com uma tela de histórico,
-- que ninguém pediu.
--
-- O relatório do modo simulação também é gravado, de propósito: é justamente
-- ele que o administrador precisa ver antes de decidir criar produto nenhum.
-- `productSyncDryRun` diz qual dos dois está ali.
--
-- IF NOT EXISTS porque o `migrate deploy` desta base está bloqueado por uma
-- migração falha anterior (P3009) e esta é aplicada à mão.
ALTER TABLE "erp_connections" ADD COLUMN IF NOT EXISTS "productSyncAt" TIMESTAMP(3);
ALTER TABLE "erp_connections" ADD COLUMN IF NOT EXISTS "productSyncDryRun" BOOLEAN;
ALTER TABLE "erp_connections" ADD COLUMN IF NOT EXISTS "productSyncReport" JSONB;
