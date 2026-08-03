-- Segmento da organização: quem ela é dentro do TradeGram.
--
-- NOT NULL com default VAREJO: o menu nunca deve enfrentar um terceiro estado
-- ("não declarado"), e as organizações existentes são operações de varejo/trade
-- hoje — VAREJO reproduz exatamente o comportamento atual, zero regressão.
--
-- Enum PRÓPRIO, não reuso de `CompanyType`: aquele é a taxonomia do diretório e
-- alimenta filtros de busca; estender enum existente e usar o valor novo na
-- mesma migração quebraria o build (o Postgres não permite dentro da mesma
-- transação), e há valores de segmento que não são tipos de empresa.
CREATE TYPE "OrgSegment" AS ENUM ('VAREJO', 'INDUSTRIA', 'DISTRIBUIDOR', 'AGENCIA', 'OUTRO');

ALTER TABLE "organization" ADD COLUMN "segment" "OrgSegment" NOT NULL DEFAULT 'VAREJO';
CREATE INDEX "organization_segment_idx" ON "organization"("segment");
