import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { auth } from "@/lib/auth";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEV_USER_EMAIL = "dev@nasaerp.com";
const DEV_USER_PASSWORD = "Nasa@12345";
const DEV_USER_NAME = "Dev NASA";

async function main() {
  console.log("Iniciando seed de dados de desenvolvimento...");

  const organization = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (!organization) {
    throw new Error("Nenhuma organização encontrada no banco — crie uma organização antes de rodar este seed.");
  }
  console.log(`Organização alvo: ${organization.name} (${organization.id})`);

  const existingUser = await prisma.user.findUnique({ where: { email: DEV_USER_EMAIL } });
  const devUser =
    existingUser ??
    (
      await auth.api.signUpEmail({
        body: { email: DEV_USER_EMAIL, password: DEV_USER_PASSWORD, name: DEV_USER_NAME },
      })
    ).user;
  console.log(`Usuário: ${devUser.name} <${devUser.email}> (${devUser.id})`);

  const existingMembership = await prisma.member.findFirst({
    where: { userId: devUser.id, organizationId: organization.id },
  });
  if (!existingMembership) {
    await prisma.member.create({
      data: { userId: devUser.id, organizationId: organization.id, role: "owner" },
    });
    console.log("Membership criada (role: owner).");
  } else {
    console.log("Usuário já é membro da organização.");
  }

  const category = await prisma.category.upsert({
    where: { organizationId_slug: { organizationId: organization.id, slug: "informatica" } },
    update: {},
    create: {
      organizationId: organization.id,
      name: "Informática",
      slug: "informatica",
      description: "Produtos de tecnologia e informática",
      order: 1,
      isActive: true,
    },
  });

  const productSeeds = [
    { name: "Notebook Gamer RTX 4060", slug: "notebook-gamer-rtx-4060", salePrice: 6699.9, sku: "NB-4060" },
    { name: "Mouse Sem Fio", slug: "mouse-sem-fio", salePrice: 89.9, sku: "MS-001" },
    { name: "Teclado Mecânico", slug: "teclado-mecanico", salePrice: 249.9, sku: "TC-001" },
    { name: "Monitor 27\" 144Hz", slug: "monitor-27-144hz", salePrice: 1599.9, sku: "MN-001" },
    { name: "Headset Gamer", slug: "headset-gamer", salePrice: 199.9, sku: "HS-001" },
  ];

  for (const productSeed of productSeeds) {
    await prisma.product.upsert({
      where: { organizationId_slug: { organizationId: organization.id, slug: productSeed.slug } },
      update: {},
      create: {
        organizationId: organization.id,
        categoryId: category.id,
        name: productSeed.name,
        slug: productSeed.slug,
        sku: productSeed.sku,
        description: productSeed.name,
        salePrice: productSeed.salePrice,
        currentStock: 20,
        minStock: 5,
        images: [],
        thumbnail: "",
        createdById: devUser.id,
      },
    });
  }
  console.log(`Produtos: ${productSeeds.length} garantidos (upsert).`);

  const collaboratorSeeds = [
    { name: "Ana Souza", role: "Garçom" },
    { name: "Bruno Lima", role: "Caixa" },
    { name: "Carla Mendes", role: "Cozinheira" },
    { name: "Diego Alves", role: "Gerente" },
  ];

  for (const collaboratorSeed of collaboratorSeeds) {
    const existingCollaborator = await prisma.collaborator.findFirst({
      where: { organizationId: organization.id, name: collaboratorSeed.name },
    });
    if (!existingCollaborator) {
      await prisma.collaborator.create({
        data: {
          organizationId: organization.id,
          name: collaboratorSeed.name,
          role: collaboratorSeed.role,
          isActive: true,
        },
      });
    }
  }
  console.log(`Colaboradores: ${collaboratorSeeds.length} garantidos.`);

  console.log("\nCredenciais de login:");
  console.log(`  Email: ${DEV_USER_EMAIL}`);
  console.log(`  Senha: ${DEV_USER_PASSWORD}`);
  console.log(`  Organização: ${organization.name} (slug: ${organization.slug})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
