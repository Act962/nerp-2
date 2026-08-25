import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import {
  MovementType,
  PersonType,
  ProductUnit,
  SaleStatus,
  PaymentMethod,
} from "@/generated/prisma/enums";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});

// ID da organização EXISTENTE que o usuário vai entrar
const EXISTING_ORGANIZATION_ID = "0w9GLWT8zvzzVajkIyeByhPoqQSusHtI";
const ExistingUser = "cmk5hry990000cogktfqnv9o6";

export async function main() {
  console.log("🌱 Iniciando seed...");

  // 5. Criar categorias
  const category1 = await prisma.category.create({
    data: {
      organizationId: EXISTING_ORGANIZATION_ID,
      name: "Eletrônicos",
      slug: "eletronicos",
      description: "Produtos eletrônicos e tecnologia",
      order: 1,
      isActive: true,
    },
  });

  const category2 = await prisma.category.create({
    data: {
      organizationId: EXISTING_ORGANIZATION_ID,
      name: "Alimentos",
      slug: "alimentos",
      description: "Produtos alimentícios",
      order: 2,
      isActive: true,
    },
  });
  console.log(`✅ Categorias criadas`);

  // 6. Criar produtos
  const products = await Promise.all([
    prisma.product.create({
      data: {
        organizationId: EXISTING_ORGANIZATION_ID,
        categoryId: category1.id,
        name: "Notebook Dell",
        slug: "notebook-dell",
        description: "Notebook Dell Inspiron 15",
        sku: "NB-DELL-001",
        barcode: "7891234567890",
        costPrice: 2500.0,
        salePrice: 3500.0,
        unit: ProductUnit.UN,
        currentStock: 5,
        minStock: 2,
        images: ["https://example.com/notebook1.jpg"],
        thumbnail: "https://example.com/notebook1-thumb.jpg",
        weight: 2.5,
        isActive: true,
        isFeatured: true,
        trackStock: true,
        createdById: ExistingUser,
      },
    }),
    prisma.product.create({
      data: {
        organizationId: EXISTING_ORGANIZATION_ID,
        categoryId: category1.id,
        name: "Mouse Logitech",
        slug: "mouse-logitech",
        description: "Mouse sem fio Logitech",
        sku: "MS-LOG-001",
        barcode: "7891234567891",
        costPrice: 50.0,
        salePrice: 89.9,
        unit: ProductUnit.UN,
        currentStock: 1, // Estoque baixo
        minStock: 5,
        images: ["https://example.com/mouse1.jpg"],
        thumbnail: "https://example.com/mouse1-thumb.jpg",
        weight: 0.2,
        isActive: true,
        trackStock: true,
        createdById: ExistingUser,
      },
    }),
    prisma.product.create({
      data: {
        organizationId: EXISTING_ORGANIZATION_ID,
        categoryId: category2.id,
        name: "Arroz Integral",
        slug: "arroz-integral",
        description: "Arroz integral 1kg",
        sku: "ALM-ARR-001",
        barcode: "7891234567892",
        costPrice: 5.0,
        salePrice: 8.5,
        unit: ProductUnit.KG,
        currentStock: 15,
        minStock: 10,
        images: ["https://example.com/arroz1.jpg"],
        thumbnail: "https://example.com/arroz1-thumb.jpg",
        weight: 1.0,
        isActive: true,
        trackStock: true,
        createdById: ExistingUser,
      },
    }),
    prisma.product.create({
      data: {
        organizationId: EXISTING_ORGANIZATION_ID,
        categoryId: category2.id,
        name: "Feijão Preto",
        slug: "feijao-preto",
        description: "Feijão preto 1kg",
        sku: "ALM-FEI-001",
        barcode: "7891234567893",
        costPrice: 6.0,
        salePrice: 10.0,
        unit: ProductUnit.KG,
        currentStock: 3, // Estoque baixo
        minStock: 8,
        images: ["https://example.com/feijao1.jpg"],
        thumbnail: "https://example.com/feijao1-thumb.jpg",
        weight: 1.0,
        isActive: true,
        trackStock: true,
        createdById: ExistingUser,
      },
    }),
  ]);
  console.log(`✅ ${products.length} produtos criados`);

  // 7. Criar clientes
  const customers = await Promise.all([
    prisma.customer.create({
      data: {
        organizationId: EXISTING_ORGANIZATION_ID,
        name: "Maria Oliveira",
        personType: PersonType.FISICA,
        document: "12345678901",
        email: "maria@example.com",
        phone: "(11) 98765-4321",
        address: "Rua das Flores",
        addressNumber: "123",
        city: "São Paulo",
        state: "SP",
        zipCode: "01234-567",
        isActive: true,
      },
    }),
    prisma.customer.create({
      data: {
        organizationId: EXISTING_ORGANIZATION_ID,
        name: "Pedro Santos",
        personType: PersonType.FISICA,
        document: "98765432100",
        email: "pedro@example.com",
        phone: "(11) 91234-5678",
        address: "Av. Paulista",
        addressNumber: "1000",
        city: "São Paulo",
        state: "SP",
        zipCode: "01310-100",
        isActive: true,
      },
    }),
    prisma.customer.create({
      data: {
        organizationId: EXISTING_ORGANIZATION_ID,
        name: "Ana Costa",
        personType: PersonType.FISICA,
        document: "11122233344",
        email: "ana@example.com",
        phone: "(11) 99999-8888",
        address: "Rua Augusta",
        addressNumber: "500",
        city: "São Paulo",
        state: "SP",
        zipCode: "01305-000",
        isActive: true,
      },
    }),
  ]);
  console.log(`✅ ${customers.length} clientes criados`);

  // 8. Criar vendas com diferentes datas
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  // Venda 1 - Hoje
  const sale1 = await prisma.sale.create({
    data: {
      organizationId: EXISTING_ORGANIZATION_ID,
      customerId: customers[0].id,
      saleNumber: 1,
      status: SaleStatus.CONFIRMED,
      subtotal: 3500.0,
      discount: 0,
      shipping: 0,
      total: 3500.0,
      paymentMethod: PaymentMethod.PIX,
      paidAt: today,
      createdById: ExistingUser,
      createdAt: today,
    },
  });

  await prisma.saleItem.create({
    data: {
      saleId: sale1.id,
      productId: products[0].id,
      productName: products[0].name,
      quantity: 1,
      unitPrice: 3500.0,
      discount: 0,
      total: 3500.0,
    },
  });

  await prisma.stockMovement.create({
    data: {
      organizationId: EXISTING_ORGANIZATION_ID,
      productId: products[0].id,
      type: MovementType.VENDA,
      quantity: 1,
      previousStock: 5,
      newStock: 4,
      unitCost: 2500.0,
      saleId: sale1.id,
      notes: "Venda para Maria Oliveira",
      createdById: ExistingUser,
      createdAt: today,
    },
  });

  // Atualizar estoque do produto
  await prisma.product.update({
    where: { id: products[0].id },
    data: { currentStock: 4 },
  });

  // Venda 2 - Ontem
  const sale2 = await prisma.sale.create({
    data: {
      organizationId: EXISTING_ORGANIZATION_ID,
      customerId: customers[1].id,
      saleNumber: 2,
      status: SaleStatus.CONFIRMED,
      subtotal: 179.8,
      discount: 0,
      shipping: 15.0,
      total: 194.8,
      paymentMethod: PaymentMethod.CREDITO,
      paidAt: yesterday,
      createdById: ExistingUser,
      createdAt: yesterday,
    },
  });

  await prisma.saleItem.create({
    data: {
      saleId: sale2.id,
      productId: products[1].id,
      productName: products[1].name,
      quantity: 2,
      unitPrice: 89.9,
      discount: 0,
      total: 179.8,
    },
  });

  await prisma.stockMovement.create({
    data: {
      organizationId: EXISTING_ORGANIZATION_ID,
      productId: products[1].id,
      type: MovementType.VENDA,
      quantity: 2,
      previousStock: 3,
      newStock: 1,
      unitCost: 50.0,
      saleId: sale2.id,
      notes: "Venda para Pedro Santos",
      createdById: ExistingUser,
      createdAt: yesterday,
    },
  });

  await prisma.product.update({
    where: { id: products[1].id },
    data: { currentStock: 1 },
  });

  // Venda 3 - Há 2 dias
  const sale3 = await prisma.sale.create({
    data: {
      organizationId: EXISTING_ORGANIZATION_ID,
      customerId: customers[2].id,
      saleNumber: 3,
      status: SaleStatus.CONFIRMED,
      subtotal: 18.5,
      discount: 1.5,
      shipping: 0,
      total: 17.0,
      paymentMethod: PaymentMethod.DINHEIRO,
      paidAt: twoDaysAgo,
      createdById: ExistingUser,
      createdAt: twoDaysAgo,
    },
  });

  await prisma.saleItem.create({
    data: {
      saleId: sale3.id,
      productId: products[2].id,
      productName: products[2].name,
      quantity: 1,
      unitPrice: 8.5,
      discount: 0,
      total: 8.5,
    },
  });

  await prisma.saleItem.create({
    data: {
      saleId: sale3.id,
      productId: products[3].id,
      productName: products[3].name,
      quantity: 1,
      unitPrice: 10.0,
      discount: 0,
      total: 10.0,
    },
  });

  await prisma.stockMovement.create({
    data: {
      organizationId: EXISTING_ORGANIZATION_ID,
      productId: products[2].id,
      type: MovementType.VENDA,
      quantity: 1,
      previousStock: 16,
      newStock: 15,
      unitCost: 5.0,
      saleId: sale3.id,
      notes: "Venda para Ana Costa",
      createdById: ExistingUser,
      createdAt: twoDaysAgo,
    },
  });

  await prisma.stockMovement.create({
    data: {
      organizationId: EXISTING_ORGANIZATION_ID,
      productId: products[3].id,
      type: MovementType.VENDA,
      quantity: 1,
      previousStock: 4,
      newStock: 3,
      unitCost: 6.0,
      saleId: sale3.id,
      notes: "Venda para Ana Costa",
      createdById: ExistingUser,
      createdAt: twoDaysAgo,
    },
  });

  await prisma.product.update({
    where: { id: products[3].id },
    data: { currentStock: 3 },
  });

  console.log(`✅ 3 vendas criadas com movimentações de estoque`);

  // 9. Verificar organização e membros
  const organization = await prisma.organization.findUnique({
    where: { id: EXISTING_ORGANIZATION_ID },
    include: {
      members: {
        include: {
          user: true,
        },
      },
    },
  });

  if (organization) {
    console.log(`\n📊 Organização: ${organization.name}`);
    console.log(`👥 Total de membros: ${organization.members.length}`);
    console.log("\nMembros:");
    organization.members.forEach((member) => {
      console.log(`  - ${member.user.name} (${member.role})`);
    });
  } else {
    console.error(`❌ Organização ${EXISTING_ORGANIZATION_ID} não encontrada!`);
  }
}

main();
