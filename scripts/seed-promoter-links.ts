import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Vincula o promotor de teste a algumas indústrias e lojas, para exercitar a
// autorização (só fotografa indústria/loja vinculada).
const connectionString = process.env.SEED_DATABASE_URL;
if (!connectionString) throw new Error("Defina SEED_DATABASE_URL.");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const ORG_SLUG = "r-carvalho";
const PROMOTER_EMAIL = "novodev@gmail.com";

async function main() {
  const org = await prisma.organization.findFirst({
    where: { slug: ORG_SLUG },
    select: { id: true },
  });
  if (!org) throw new Error(`Org ${ORG_SLUG} não encontrada.`);

  const user = await prisma.user.findFirst({
    where: { email: PROMOTER_EMAIL },
    select: { id: true },
  });
  if (!user) throw new Error(`Usuário ${PROMOTER_EMAIL} não encontrado.`);

  const member = await prisma.member.findFirst({
    where: { organizationId: org.id, userId: user.id },
    select: { id: true, role: true },
  });
  if (!member) throw new Error("Member não encontrado na org.");

  // Vincula às 2 primeiras indústrias e 3 primeiras lojas (para dar contraste:
  // as demais NÃO aparecem/são bloqueadas para este promotor).
  const suppliers = await prisma.supplier.findMany({
    where: { organizationId: org.id },
    orderBy: { name: "asc" },
    take: 2,
    select: { id: true, name: true },
  });
  const stores = await prisma.store.findMany({
    where: { organizationId: org.id, isActive: true },
    orderBy: { name: "asc" },
    take: 3,
    select: { id: true, name: true },
  });

  for (const supplier of suppliers) {
    await prisma.promoterSupplier.upsert({
      where: {
        memberId_supplierId: { memberId: member.id, supplierId: supplier.id },
      },
      create: {
        organizationId: org.id,
        memberId: member.id,
        supplierId: supplier.id,
      },
      update: {},
    });
  }
  for (const store of stores) {
    await prisma.promoterStore.upsert({
      where: { memberId_storeId: { memberId: member.id, storeId: store.id } },
      create: {
        organizationId: org.id,
        memberId: member.id,
        storeId: store.id,
      },
      update: {},
    });
  }

  console.log(
    `promotor ${PROMOTER_EMAIL} (role ${member.role}) vinculado a ${suppliers.length} indústrias e ${stores.length} lojas`,
  );
  console.log(`  indústrias: ${suppliers.map((s) => s.name).join(", ")}`);
  console.log(`  lojas: ${stores.map((s) => s.name).join(", ")}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
