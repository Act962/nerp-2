import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { MovementType, ProductUnit } from "@/generated/prisma/enums";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});

const PLACEHOLDER_IMAGE = "https://placehold.co/600x400/png";

type ProductSeed = {
  name: string;
  description: string;
  sku: string;
  barcode: string;
  costPrice: number;
  salePrice: number;
  unit: ProductUnit;
  initialStock: number;
  minStock: number;
};

// Categorias e seus produtos. Para cada produto será criada uma
// movimentação de estoque (ENTRADA) e o currentStock será ajustado.
const CATEGORIES: { name: string; slug: string; products: ProductSeed[] }[] = [
  {
    name: "Bebidas",
    slug: "bebidas",
    products: [
      {
        name: "Coca-Cola Lata 350ml",
        description: "Refrigerante Coca-Cola lata 350ml",
        sku: "BEB-COCA-350",
        barcode: "7894900011517",
        costPrice: 2.5,
        salePrice: 5.0,
        unit: ProductUnit.UN,
        initialStock: 120,
        minStock: 24,
      },
      {
        name: "Água Mineral 500ml",
        description: "Água mineral sem gás 500ml",
        sku: "BEB-AGUA-500",
        barcode: "7891234500011",
        costPrice: 0.9,
        salePrice: 3.0,
        unit: ProductUnit.UN,
        initialStock: 200,
        minStock: 40,
      },
      {
        name: "Suco de Laranja 1L",
        description: "Suco de laranja integral 1 litro",
        sku: "BEB-SUCO-1L",
        barcode: "7891234500028",
        costPrice: 5.5,
        salePrice: 11.9,
        unit: ProductUnit.L,
        initialStock: 60,
        minStock: 12,
      },
      {
        name: "Cerveja Pilsen 600ml",
        description: "Cerveja pilsen garrafa 600ml",
        sku: "BEB-CERV-600",
        barcode: "7891234500035",
        costPrice: 4.0,
        salePrice: 9.5,
        unit: ProductUnit.UN,
        initialStock: 90,
        minStock: 24,
      },
    ],
  },
  {
    name: "Lanches",
    slug: "lanches",
    products: [
      {
        name: "X-Burguer",
        description: "Pão, hambúrguer, queijo e salada",
        sku: "LAN-XBUR-001",
        barcode: "7891234600011",
        costPrice: 6.0,
        salePrice: 18.9,
        unit: ProductUnit.UN,
        initialStock: 50,
        minStock: 10,
      },
      {
        name: "X-Salada",
        description: "Pão, hambúrguer, queijo, alface e tomate",
        sku: "LAN-XSAL-001",
        barcode: "7891234600028",
        costPrice: 7.0,
        salePrice: 21.9,
        unit: ProductUnit.UN,
        initialStock: 45,
        minStock: 10,
      },
      {
        name: "Batata Frita Porção",
        description: "Porção de batata frita 300g",
        sku: "LAN-BATA-300",
        barcode: "7891234600035",
        costPrice: 4.5,
        salePrice: 15.0,
        unit: ProductUnit.UN,
        initialStock: 70,
        minStock: 15,
      },
      {
        name: "Hot Dog Completo",
        description: "Cachorro-quente com molho, batata palha e queijo",
        sku: "LAN-HOTD-001",
        barcode: "7891234600042",
        costPrice: 5.0,
        salePrice: 14.0,
        unit: ProductUnit.UN,
        initialStock: 60,
        minStock: 12,
      },
    ],
  },
  {
    name: "Mercearia",
    slug: "mercearia",
    products: [
      {
        name: "Arroz Branco 5kg",
        description: "Arroz branco tipo 1 pacote 5kg",
        sku: "MER-ARRO-5KG",
        barcode: "7891234700011",
        costPrice: 18.0,
        salePrice: 27.9,
        unit: ProductUnit.UN,
        initialStock: 80,
        minStock: 20,
      },
      {
        name: "Feijão Carioca 1kg",
        description: "Feijão carioca tipo 1 pacote 1kg",
        sku: "MER-FEIJ-1KG",
        barcode: "7891234700028",
        costPrice: 5.5,
        salePrice: 9.9,
        unit: ProductUnit.KG,
        initialStock: 100,
        minStock: 25,
      },
      {
        name: "Açúcar Refinado 1kg",
        description: "Açúcar refinado pacote 1kg",
        sku: "MER-ACUC-1KG",
        barcode: "7891234700035",
        costPrice: 3.2,
        salePrice: 5.9,
        unit: ProductUnit.KG,
        initialStock: 150,
        minStock: 30,
      },
      {
        name: "Óleo de Soja 900ml",
        description: "Óleo de soja garrafa 900ml",
        sku: "MER-OLEO-900",
        barcode: "7891234700042",
        costPrice: 6.0,
        salePrice: 9.5,
        unit: ProductUnit.UN,
        initialStock: 90,
        minStock: 20,
      },
    ],
  },
];

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function main() {
  console.log("🌱 Iniciando seed de produtos e estoques...");

  // 1. Buscar a primeira organização do sistema
  const organization = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
    include: {
      members: {
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });

  if (!organization) {
    throw new Error(
      "❌ Nenhuma organização encontrada no sistema. Crie uma organização antes de rodar este seed.",
    );
  }

  const organizationId = organization.id;
  console.log(`🏢 Organização: ${organization.name} (${organizationId})`);

  // 2. Descobrir um usuário válido para createdById (membro da org ou primeiro usuário)
  const createdById =
    organization.members[0]?.userId ??
    (await prisma.user.findFirst({ orderBy: { createdAt: "asc" } }))?.id;

  if (!createdById) {
    throw new Error(
      "❌ Nenhum usuário encontrado para associar como criador dos produtos.",
    );
  }
  console.log(`👤 Criador dos produtos: ${createdById}`);

  let totalProducts = 0;
  let totalMovements = 0;

  // 3. Criar categorias, produtos e estoques
  for (const categorySeed of CATEGORIES) {
    const category = await prisma.category.upsert({
      where: {
        organizationId_slug: {
          organizationId,
          slug: categorySeed.slug,
        },
      },
      update: {},
      create: {
        organizationId,
        name: categorySeed.name,
        slug: categorySeed.slug,
        isActive: true,
      },
    });
    console.log(`\n📂 Categoria: ${category.name}`);

    for (const item of categorySeed.products) {
      const slug = slugify(item.name);

      // Cria o produto já com o estoque inicial
      const product = await prisma.product.upsert({
        where: {
          organizationId_slug: {
            organizationId,
            slug,
          },
        },
        update: {},
        create: {
          organizationId,
          categoryId: category.id,
          name: item.name,
          slug,
          description: item.description,
          sku: item.sku,
          barcode: item.barcode,
          costPrice: item.costPrice,
          salePrice: item.salePrice,
          unit: item.unit,
          currentStock: item.initialStock,
          minStock: item.minStock,
          images: [PLACEHOLDER_IMAGE],
          thumbnail: PLACEHOLDER_IMAGE,
          isActive: true,
          trackStock: true,
          createdById,
        },
      });
      totalProducts += 1;

      // Cria a movimentação de estoque (ENTRADA inicial)
      await prisma.stockMovement.create({
        data: {
          organizationId,
          productId: product.id,
          type: MovementType.ENTRADA,
          quantity: item.initialStock,
          previousStock: 0,
          newStock: item.initialStock,
          unitCost: item.costPrice,
          notes: "Estoque inicial (seed)",
          createdById,
        },
      });
      totalMovements += 1;

      console.log(
        `  ✅ ${product.name} — estoque inicial: ${item.initialStock} ${item.unit}`,
      );
    }
  }

  console.log(
    `\n✨ Seed concluído: ${totalProducts} produtos e ${totalMovements} movimentações de estoque criados.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
