/**
 * Audita duplicatas de (organizationId, barcode) ANTES de aplicar o unique.
 *
 * O unique é o que viabiliza `ON CONFLICT` no importador massivo — sem chave
 * natural não há caminho para 400k linhas. Mas `pnpm build` roda
 * `prisma migrate deploy`: uma migration que falha por duplicata **quebra o
 * deploy**, não só o runtime. Por isso este script só REPORTA.
 *
 * Uso: npx tsx --env-file=.env scripts/audit-product-barcode.ts
 */
import prisma from "@/lib/db";

interface DuplicateRow {
  organizationId: string;
  barcode: string;
  total: bigint;
}

async function main() {
  const totalProducts = await prisma.product.count();
  const withBarcode = await prisma.product.count({
    where: { barcode: { not: null } },
  });

  console.log(`Produtos: ${totalProducts}`);
  console.log(`  com barcode: ${withBarcode}`);
  console.log(
    `  sem barcode: ${totalProducts - withBarcode} (NULL não conflita em UNIQUE no Postgres)`,
  );

  // String vazia NÃO é NULL — se houver várias, elas colidem entre si.
  const emptyBarcode = await prisma.product.count({ where: { barcode: "" } });
  if (emptyBarcode > 0) {
    console.log(
      `\n  ATENÇÃO: ${emptyBarcode} produto(s) com barcode = "" (string vazia).`,
    );
    console.log(`  String vazia colide no unique. Precisa virar NULL antes.`);
  }

  const duplicates = await prisma.$queryRaw<DuplicateRow[]>`
    SELECT "organizationId", "barcode", COUNT(*) AS total
    FROM products
    WHERE "barcode" IS NOT NULL AND "barcode" <> ''
    GROUP BY "organizationId", "barcode"
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
    LIMIT 50
  `;

  if (duplicates.length === 0) {
    console.log(`\n✅ Nenhuma duplicata de (org, barcode).`);
    console.log(`   O unique pode ser aplicado com segurança.`);
  } else {
    console.log(`\n❌ ${duplicates.length} grupo(s) duplicado(s) — amostra:`);
    for (const row of duplicates) {
      console.log(
        `   org=${row.organizationId.slice(0, 8)} barcode=${row.barcode} → ${row.total} produtos`,
      );
    }
    console.log(`\n   O unique NÃO pode ser aplicado antes de resolver.`);
    console.log(
      `   Decidir com o dono: consolidar, ou zerar o barcode dos repetidos.`,
    );
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("FALHOU:", error instanceof Error ? error.message : error);
  process.exit(1);
});
