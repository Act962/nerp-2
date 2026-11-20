-- Atendimento humano no Astro do site: quando o visitante pede uma pessoa, a
-- conversa passa a correr no Chat do Órbita (canal ASTRO CHAT).
--
-- Aditiva, com IF NOT EXISTS por causa do banco compartilhado.
-- `handoffToken` é o token do visitante no ASTRO CHAT — é ele que mantém as
-- mensagens seguintes na mesma conversa; `handoffAt`, desde quando a sessão é
-- da equipe. Sessão antiga nasce com os dois nulos: nunca pediu gente.
ALTER TABLE "site_chat_sessions"
  ADD COLUMN IF NOT EXISTS "handoffToken" TEXT,
  ADD COLUMN IF NOT EXISTS "handoffAt" TIMESTAMP(3);
