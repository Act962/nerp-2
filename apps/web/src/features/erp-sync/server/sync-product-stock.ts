import "server-only";

import prisma from "@/lib/db";
import { loadOracleConfig } from "./connectors";
import { fetchWinthorProductStock } from "./connectors/winthor-products";

// Espelha o estoque POR FILIAL do ERP (`PCEST`) em `product_branch_stocks`.
//
// Existe porque o catálogo precisa responder "quais produtos estão ativos nesta
// filial?" sem falar com o Oracle: o diálogo de adicionar produto pagina sobre
// a tabela `products` do Postgres, e amarrar cada filtro ao banco on-prem do
// cliente entregaria a montagem do encarte à latência (e à disponibilidade)
// dele.
//
// O conector já devolve só filial COM estoque, então aqui "linha existe" é
// "tem estoque" — ver o doc de `ProductBranchStock` no schema.

export interface ProductStockSyncReport {
  /** Linhas lidas do ERP (produto × filial com estoque). */
  read: number;
  /** Quantas casaram com um produto do cadastro local. */
  matched: number;
  /** Filiais distintas vistas nesta passada. */
  branches: number;
  dryRun: boolean;
}

/** Insere em blocos: 6 colunas × 5 mil linhas cabe no teto de parâmetros do PG. */
const INSERT_CHUNK = 5000;

export async function syncErpProductStock(
  organizationId: string,
  { dryRun = false }: { dryRun?: boolean } = {},
): Promise<ProductStockSyncReport> {
  const config = await loadOracleConfig(organizationId);
  const rows = await fetchWinthorProductStock(config);

  // `erpCode` é o CODPROD gravado pelo sync do cadastro — é por ele que o
  // estoque acha o produto local. Quem ainda não foi sincronizado não tem
  // `erpCode` e simplesmente não recebe estoque.
  const local = await prisma.product.findMany({
    where: { organizationId, erpCode: { not: null } },
    select: { id: true, erpCode: true },
  });
  const idByErpCode = new Map(
    local.flatMap((p) => (p.erpCode ? [[p.erpCode, p.id] as const] : [])),
  );

  const syncedAt = new Date();
  const branches = new Set<string>();
  const seen = new Set<string>();
  const data: {
    organizationId: string;
    productId: string;
    branchCode: string;
    branchName: string | null;
    stock: number;
    syncedAt: Date;
  }[] = [];

  for (const row of rows) {
    branches.add(row.branchCode);
    const productId = idByErpCode.get(row.externalCode);
    if (!productId) continue;
    // O `@@unique([productId, branchCode])` recusaria o lote inteiro se o ERP
    // devolvesse a mesma dupla duas vezes.
    const key = `${productId}:${row.branchCode}`;
    if (seen.has(key)) continue;
    seen.add(key);
    data.push({
      organizationId,
      productId,
      branchCode: row.branchCode,
      branchName: row.branchName,
      stock: row.stock,
      syncedAt,
    });
  }

  const report: ProductStockSyncReport = {
    read: rows.length,
    matched: data.length,
    branches: branches.size,
    dryRun,
  };
  if (dryRun) return report;

  // Substituição inteira, numa transação só: o espelho é um retrato do ERP, e
  // produto que ZEROU não vem na leitura — sem o delete ele ficaria "com
  // estoque" para sempre. Apagar e inserir fora de transação abriria uma
  // janela em que o catálogo não acharia nada.
  const inserts = [];
  for (let i = 0; i < data.length; i += INSERT_CHUNK) {
    inserts.push(
      prisma.productBranchStock.createMany({
        data: data.slice(i, i + INSERT_CHUNK),
      }),
    );
  }
  await prisma.$transaction([
    prisma.productBranchStock.deleteMany({ where: { organizationId } }),
    ...inserts,
  ]);

  return report;
}
