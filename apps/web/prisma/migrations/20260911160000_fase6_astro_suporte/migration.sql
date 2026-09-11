-- O teto diário de conversa por organização soma o `message_count` das sessões
-- do dia. Sem este índice, a contagem varre a tabela inteira a cada mensagem
-- de cada organização — e ela é a tabela que mais cresce do sistema.
CREATE INDEX IF NOT EXISTS "site_chat_sessions_organization_id_created_at_idx"
  ON "site_chat_sessions"("organizationId", "createdAt");
