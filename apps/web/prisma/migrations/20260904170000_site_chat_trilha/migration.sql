-- Por onde o visitante passou antes de falar com o Astro.
--
-- Só chega aqui quando a conversa começa: a trilha é montada no navegador e
-- sobe junto da primeira mensagem, depois do aviso de privacidade. Guardar a
-- navegação de quem nunca conversou seria perfilar visitante anônimo.

ALTER TABLE "site_chat_sessions" ADD COLUMN IF NOT EXISTS "trilha" JSONB;
