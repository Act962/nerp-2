-- Qual modelo respondeu cada conversa.
--
-- Os tokens sozinhos não viram custo: o preço por mil tokens do modelo leve e
-- o do Pro diferem em mais de dez vezes. Sem esta coluna, o painel do admin só
-- consegue estimar o gasto com o Gemini por média, que é chute com cara de
-- relatório.
ALTER TABLE "site_chat_sessions" ADD COLUMN IF NOT EXISTS "modelo" TEXT;
