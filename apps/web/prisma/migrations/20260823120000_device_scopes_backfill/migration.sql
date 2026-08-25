-- Escopos de dispositivo passaram a ser VERIFICADOS (fail-closed) no
-- `requireAuthMiddleware`. Terminais pareados antes disso nasceram com
-- `scopes = '{}'` — que agora significa "não pode nada" — e parariam de
-- vender no primeiro deploy.
--
-- Backfill com os escopos de PDV (= `DEFAULT_DEVICE_SCOPES` em
-- `src/lib/device-scopes.ts`), que é exatamente o alcance que esses devices
-- já tinham na prática. Só toca terminais ativos: um device revogado
-- continua revogado, e reidratá-lo seria reabrir acesso de propósito.
--
-- O IS NULL não é redundante: a coluna nasceu nullable e sem DEFAULT (ver
-- `20260818120000_device`), e `scopes` é opcional no create do Prisma — então
-- existe linha com NULL, e `NULL = '{}'` não é true. Sem este ramo, esse
-- terminal escaparia do backfill e ficaria travado sem sinal nenhum.
UPDATE "devices"
SET "scopes" = ARRAY['pdv:sync', 'pdv:sales', 'pdv:caixa']
WHERE ("scopes" IS NULL OR "scopes" = '{}') AND "revokedAt" IS NULL;
