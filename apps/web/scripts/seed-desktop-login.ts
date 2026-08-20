/**
 * Seed de TESTE MANUAL do app desktop (login real → PDV). Descartável.
 *
 * Prisma-only (NÃO importa `@/lib/auth`, que arrasta `server-only` e quebra fora
 * do bundler do Next): dado um usuário JÁ criado com senha via Better Auth (pelo
 * endpoint HTTP `/api/auth/sign-up/email`), cria/garante a org com ele de owner e
 * alguns produtos com estoque — para testar `device.pairWithCredentials` (login
 * nativo) e o PDV contra um backend LOCAL.
 *
 * Uso: DATABASE_URL=postgres://...5433 pnpm --filter @nerp/web exec tsx scripts/seed-desktop-login.ts <email>
 */
import prisma from "@/lib/db";

const ORG_SLUG = "loja-local-teste";
const ORG_NAME = "Loja Local Teste";

async function main() {
  const email = process.argv[2];
  if (!email) throw new Error("Informe o e-mail do usuário: tsx seed-desktop-login.ts <email>");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error(
      `Usuário ${email} não existe. Crie primeiro via /api/auth/sign-up/email.`,
    );
  }

  const org = await prisma.organization.upsert({
    where: { slug: ORG_SLUG },
    update: {},
    create: { name: ORG_NAME, slug: ORG_SLUG },
  });

  const member = await prisma.member.findFirst({
    where: { organizationId: org.id, userId: user.id },
  });
  if (!member) {
    await prisma.member.create({
      data: { organizationId: org.id, userId: user.id, role: "owner" },
    });
  }

  const count = await prisma.product.count({
    where: { organizationId: org.id },
  });
  if (count === 0) {
    await prisma.product.createMany({
      data: [
        { name: "Café Torrado 500g", slug: "cafe-500g", sku: "CAFE500", barcode: "7891000100101", salePrice: 18.9, currentStock: 100, organizationId: org.id, createdById: user.id },
        { name: "Açúcar Refinado 1kg", slug: "acucar-1kg", sku: "ACU1KG", barcode: "7891000100102", salePrice: 4.5, currentStock: 100, organizationId: org.id, createdById: user.id },
        { name: "Leite Integral 1L", slug: "leite-1l", sku: "LEITE1L", barcode: "7891000100103", salePrice: 5.2, currentStock: 100, organizationId: org.id, createdById: user.id },
        { name: "Arroz Branco 5kg", slug: "arroz-5kg", sku: "ARROZ5", barcode: "7891000100104", salePrice: 27.9, currentStock: 100, organizationId: org.id, createdById: user.id },
        { name: "Feijão Carioca 1kg", slug: "feijao-1kg", sku: "FEIJAO1", barcode: "7891000100105", salePrice: 8.75, currentStock: 100, organizationId: org.id, createdById: user.id },
      ],
    });
  }

  const total = await prisma.product.count({
    where: { organizationId: org.id },
  });
  console.info(
    `\n✅ Seed pronto (banco local)\n   Org:      ${org.name}\n   Usuário:  ${email}\n   Produtos: ${total}\n`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
