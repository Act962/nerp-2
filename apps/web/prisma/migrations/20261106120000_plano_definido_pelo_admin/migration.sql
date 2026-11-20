-- Plano escolhido pelo admin da plataforma no painel de Empresas. Sem a
-- assinatura paga ligada, toda organização criada desde 10/09/2026 ficava presa
-- no plano Grátis (10 produtos) sem nenhuma forma de trocar.
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "plano_definido_pelo_admin" TEXT;
