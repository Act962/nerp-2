/**
 * Seed de PRODUTOS para uma org (por slug), idempotente. Descartável / teste manual.
 *
 * Prisma-only (não importa `@/lib/auth`). Faz upsert por (organizationId, slug),
 * então rodar de novo não duplica. Usa um membro da org como `createdById`.
 *
 * Uso: DATABASE_URL=postgres://...5433 pnpm --filter @nerp/web exec tsx scripts/seed-products.ts <org-slug>
 */
import prisma from "@/lib/db";

type Seed = {
  name: string;
  slug: string;
  sku: string;
  barcode: string;
  salePrice: number;
  currentStock: number;
};

const CATALOGO: Seed[] = [
  { name: "Café Torrado e Moído 500g", slug: "cafe-torrado-500g", sku: "ACT-CAFE500", barcode: "7896001000011", salePrice: 18.9, currentStock: 120 },
  { name: "Açúcar Refinado 1kg", slug: "acucar-refinado-1kg", sku: "ACT-ACU1KG", barcode: "7896001000028", salePrice: 4.5, currentStock: 200 },
  { name: "Leite Integral 1L", slug: "leite-integral-1l", sku: "ACT-LEITE1L", barcode: "7896001000035", salePrice: 5.2, currentStock: 150 },
  { name: "Arroz Branco Tipo 1 5kg", slug: "arroz-branco-5kg", sku: "ACT-ARROZ5", barcode: "7896001000042", salePrice: 27.9, currentStock: 80 },
  { name: "Feijão Carioca 1kg", slug: "feijao-carioca-1kg", sku: "ACT-FEIJAO1", barcode: "7896001000059", salePrice: 8.75, currentStock: 90 },
  { name: "Óleo de Soja 900ml", slug: "oleo-soja-900ml", sku: "ACT-OLEO900", barcode: "7896001000066", salePrice: 7.4, currentStock: 110 },
  { name: "Macarrão Espaguete 500g", slug: "macarrao-espaguete-500g", sku: "ACT-MACA500", barcode: "7896001000073", salePrice: 3.99, currentStock: 130 },
  { name: "Farinha de Trigo 1kg", slug: "farinha-trigo-1kg", sku: "ACT-FARINHA1", barcode: "7896001000080", salePrice: 5.6, currentStock: 100 },
  { name: "Refrigerante Cola 2L", slug: "refrigerante-cola-2l", sku: "ACT-REFRI2L", barcode: "7896001000097", salePrice: 8.99, currentStock: 75 },
  { name: "Água Mineral sem Gás 1,5L", slug: "agua-mineral-15l", sku: "ACT-AGUA15", barcode: "7896001000103", salePrice: 2.5, currentStock: 220 },
  { name: "Sabão em Pó 1kg", slug: "sabao-po-1kg", sku: "ACT-SABAO1", barcode: "7896001000110", salePrice: 12.9, currentStock: 60 },
  { name: "Papel Higiênico 12 rolos", slug: "papel-higienico-12", sku: "ACT-PAPEL12", barcode: "7896001000127", salePrice: 19.9, currentStock: 70 },
];

async function main() {
  const slug = process.argv[2];
  if (!slug) throw new Error("Informe o slug da org: tsx seed-products.ts <org-slug>");

  const org = await prisma.organization.findUnique({ where: { slug } });
  if (!org) throw new Error(`Org com slug "${slug}" não encontrada.`);

  const member = await prisma.member.findFirst({
    where: { organizationId: org.id },
    orderBy: { role: "asc" }, // owner/admin primeiro
  });
  if (!member) throw new Error(`Org "${org.name}" não tem membros — preciso de um para createdById.`);

  for (const p of CATALOGO) {
    await prisma.product.upsert({
      where: { organizationId_slug: { organizationId: org.id, slug: p.slug } },
      update: {
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        salePrice: p.salePrice,
        currentStock: p.currentStock,
      },
      create: {
        organizationId: org.id,
        createdById: member.userId,
        name: p.name,
        slug: p.slug,
        sku: p.sku,
        barcode: p.barcode,
        salePrice: p.salePrice,
        currentStock: p.currentStock,
      },
    });
  }

  const total = await prisma.product.count({ where: { organizationId: org.id } });
  console.info(
    `\n✅ Seed de produtos concluído\n   Org:      ${org.name} (${slug})\n   Semeados: ${CATALOGO.length}\n   Total na org: ${total}\n`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
