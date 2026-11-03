-- Empresas vindas do ÓRBITA pelo sync chegavam sem verified_at e viravam sandbox
-- (bloqueadas para integrações e apagadas após 30 dias sem acesso). Sandbox de
-- verdade só tem dono anônimo; empresa com algum membro identificado é real.
UPDATE "organization" AS o
SET "verified_at" = o."createdAt"
WHERE o."verified_at" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "member" AS m
    JOIN "user" AS u ON u."id" = m."userId"
    WHERE m."organizationId" = o."id"
      AND u."isAnonymous" = false
  );
