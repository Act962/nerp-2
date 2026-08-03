-- Só dígitos no banco, máscara só na renderização.
--
-- O documento vinha sendo gravado cru, com a máscara que a pessoa digitou — o
-- que fazia toda dedupe por documento falhar em silêncio quando um lado usou
-- pontuação e o outro não.
--
-- Tabelas SEM índice único: normalização direta é segura.
UPDATE "suppliers"    SET "document" = regexp_replace("document", '\D', '', 'g') WHERE "document" IS NOT NULL;
UPDATE "distributors" SET "document" = regexp_replace("document", '\D', '', 'g') WHERE "document" IS NOT NULL;

-- Tabelas COM índice único: normalizar pode colidir. Normaliza só onde NÃO
-- colide; as linhas restantes ficam cruas de propósito. Um build quebrado por
-- violação de unicidade seria pior — e elas são auditáveis por `document ~ '\D'`.
UPDATE "directory_companies" c SET "document" = regexp_replace(c."document", '\D', '', 'g')
 WHERE c."document" IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM "directory_companies" o
      WHERE o.id <> c.id AND o."document" = regexp_replace(c."document", '\D', '', 'g')
   );

UPDATE "organization" o SET "document" = regexp_replace(o."document", '\D', '', 'g')
 WHERE o."document" IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM "organization" x
      WHERE x.id <> o.id AND x."document" = regexp_replace(o."document", '\D', '', 'g')
   );
