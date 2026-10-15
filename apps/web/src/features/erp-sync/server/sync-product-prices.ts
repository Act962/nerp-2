import "server-only";

import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { loadOracleConfig } from "./connectors";
import { fetchWinthorLastSalePrices } from "./connectors/winthor-products";

// Preenche o preço VAZIO do produto com o último preço de tabela vendido no ERP
// (spec erp-sync-estoque-preco-winthor). Preço digitado no nerp nunca é
// sobrescrito: o UPDATE só pega `salePrice = 0`. O encarte do Catálogo
// Promocional usa o preço do produto como fonte, e o "De"/"Por" editado nele
// continua valendo só para ele.

export interface ProductPriceSyncReport {
  branchCode: string | null;
  /** Produtos com último preço vendido na janela, lidos do ERP. */
  read: number;
  /** Produtos que estavam com preço 0 e receberam o do ERP. */
  pricesFilled: number;
}

/** Linhas por UPDATE: 2 parâmetros por linha, longe do teto do Postgres. */
const UPDATE_CHUNK = 1000;

export async function syncErpProductPrices(
  organizationId: string,
): Promise<ProductPriceSyncReport> {
  const connection = await prisma.erpConnection.findUnique({
    where: { organizationId },
    select: { stockBranchCode: true },
  });
  const branchCode = connection?.stockBranchCode ?? null;
  // O preço é da filial que atende o catálogo; sem ela escolhida, não há de onde tirar.
  if (!branchCode) return { branchCode, read: 0, pricesFilled: 0 };

  const config = await loadOracleConfig(organizationId);
  const prices = await fetchWinthorLastSalePrices(config, branchCode);
  const valid = prices.filter(
    (row) => Number.isFinite(row.price) && row.price > 0,
  );

  let pricesFilled = 0;
  for (let i = 0; i < valid.length; i += UPDATE_CHUNK) {
    const values = valid
      .slice(i, i + UPDATE_CHUNK)
      .map((row) => Prisma.sql`(${row.externalCode}, ${row.price}::numeric)`);
    pricesFilled += await prisma.$executeRaw(Prisma.sql`
      UPDATE products AS p
         SET "salePrice" = ROUND(v.price, 2)
        FROM (VALUES ${Prisma.join(values)}) AS v(code, price)
       WHERE p."organizationId" = ${organizationId}
         AND p."erpCode" = v.code
         AND p."salePrice" = 0`);
  }

  return { branchCode, read: valid.length, pricesFilled };
}
