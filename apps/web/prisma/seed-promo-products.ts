import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { MovementType, ProductUnit } from "@/generated/prisma/enums";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const THUMB = "https://placehold.co/400x400/png";

type ProductSeed = {
  name: string;
  description: string;
  sku: string;
  costPrice: number;
  salePrice: number;
  promotionalPrice?: number;
  unit: ProductUnit;
  stock: number;
  minStock: number;
};

const CATEGORIES: { name: string; slug: string; products: ProductSeed[] }[] = [
  {
    name: "Eletrônicos",
    slug: "eletronicos",
    products: [
      {
        name: "Fone Bluetooth JBL T510",
        description: "Fone de ouvido over-ear sem fio com microfone",
        sku: "ELE-JBL-T510",
        costPrice: 89.9,
        salePrice: 189.9,
        promotionalPrice: 139.9,
        unit: ProductUnit.UN,
        stock: 45,
        minStock: 5,
      },
      {
        name: "Carregador USB-C 65W",
        description: "Carregador rápido USB-C 65W compatível com notebooks e smartphones",
        sku: "ELE-CAR-65W",
        costPrice: 35.0,
        salePrice: 89.9,
        promotionalPrice: 59.9,
        unit: ProductUnit.UN,
        stock: 80,
        minStock: 10,
      },
      {
        name: "Cabo HDMI 2.0 2m",
        description: "Cabo HDMI 2.0 suporte 4K 60Hz, 2 metros",
        sku: "ELE-HDMI-2M",
        costPrice: 12.0,
        salePrice: 35.9,
        unit: ProductUnit.UN,
        stock: 120,
        minStock: 20,
      },
      {
        name: "Mouse Gamer RGB 7200 DPI",
        description: "Mouse gamer com RGB e 7200 DPI ajustável",
        sku: "ELE-MOU-RGB",
        costPrice: 55.0,
        salePrice: 129.9,
        promotionalPrice: 99.9,
        unit: ProductUnit.UN,
        stock: 35,
        minStock: 5,
      },
      {
        name: "Teclado Mecânico Switch Blue",
        description: "Teclado mecânico ABNT2 com switch blue retroiluminado",
        sku: "ELE-TEC-MEC",
        costPrice: 120.0,
        salePrice: 279.9,
        promotionalPrice: 219.9,
        unit: ProductUnit.UN,
        stock: 20,
        minStock: 3,
      },
      {
        name: "Hub USB 4 Portas",
        description: "Hub USB 3.0 com 4 portas e cabo 1m",
        sku: "ELE-HUB-4P",
        costPrice: 22.0,
        salePrice: 59.9,
        unit: ProductUnit.UN,
        stock: 60,
        minStock: 10,
      },
      {
        name: "Webcam Full HD 1080p",
        description: "Webcam 1080p com microfone integrado e ajuste automático",
        sku: "ELE-WEB-HD",
        costPrice: 75.0,
        salePrice: 169.9,
        promotionalPrice: 129.9,
        unit: ProductUnit.UN,
        stock: 28,
        minStock: 4,
      },
      {
        name: "Pen Drive 64GB USB 3.0",
        description: "Pen drive 64GB com leitura de até 120MB/s",
        sku: "ELE-PEN-64",
        costPrice: 18.0,
        salePrice: 49.9,
        promotionalPrice: 34.9,
        unit: ProductUnit.UN,
        stock: 150,
        minStock: 30,
      },
    ],
  },
  {
    name: "Casa & Cozinha",
    slug: "casa-cozinha",
    products: [
      {
        name: "Panela Antiaderente 24cm",
        description: "Panela antiaderente com cabo ergonômico e tampa de vidro",
        sku: "CAS-PAN-24",
        costPrice: 35.0,
        salePrice: 89.9,
        promotionalPrice: 64.9,
        unit: ProductUnit.UN,
        stock: 40,
        minStock: 5,
      },
      {
        name: "Jogo de Facas 5 Peças",
        description: "Jogo de facas em aço inox com suporte de madeira",
        sku: "CAS-FAC-5P",
        costPrice: 55.0,
        salePrice: 139.9,
        unit: ProductUnit.UN,
        stock: 25,
        minStock: 3,
      },
      {
        name: "Liquidificador 700W",
        description: "Liquidificador 700W com 12 velocidades e copo de vidro",
        sku: "CAS-LIQ-700",
        costPrice: 89.0,
        salePrice: 199.9,
        promotionalPrice: 159.9,
        unit: ProductUnit.UN,
        stock: 18,
        minStock: 2,
      },
      {
        name: "Cafeteira Elétrica 600ml",
        description: "Cafeteira elétrica com filtro permanente e jarra de vidro",
        sku: "CAS-CAF-600",
        costPrice: 45.0,
        salePrice: 109.9,
        unit: ProductUnit.UN,
        stock: 22,
        minStock: 3,
      },
      {
        name: "Toalha de Banho 70x140cm",
        description: "Toalha de banho 100% algodão fio penteado",
        sku: "CAS-TOA-BAN",
        costPrice: 18.0,
        salePrice: 49.9,
        promotionalPrice: 39.9,
        unit: ProductUnit.UN,
        stock: 100,
        minStock: 20,
      },
      {
        name: "Organizador de Gaveta 12 Divisórias",
        description: "Organizador plástico para gavetas com 12 divisórias ajustáveis",
        sku: "CAS-ORG-12D",
        costPrice: 12.0,
        salePrice: 34.9,
        unit: ProductUnit.UN,
        stock: 55,
        minStock: 10,
      },
      {
        name: "Tapete Antiderrapante 40x60cm",
        description: "Tapete de banheiro antiderrapante lavável",
        sku: "CAS-TAP-40",
        costPrice: 14.0,
        salePrice: 39.9,
        promotionalPrice: 29.9,
        unit: ProductUnit.UN,
        stock: 70,
        minStock: 15,
      },
      {
        name: "Dispenser de Sabão Inox 400ml",
        description: "Porta sabão líquido em inox escovado para pia",
        sku: "CAS-DIS-400",
        costPrice: 22.0,
        salePrice: 59.9,
        unit: ProductUnit.UN,
        stock: 45,
        minStock: 8,
      },
    ],
  },
  {
    name: "Esportes",
    slug: "esportes",
    products: [
      {
        name: "Garrafa Térmica 1L Inox",
        description: "Garrafa térmica 1L em aço inox, mantém frio por 24h e quente por 12h",
        sku: "ESP-GAR-1L",
        costPrice: 40.0,
        salePrice: 99.9,
        promotionalPrice: 74.9,
        unit: ProductUnit.UN,
        stock: 60,
        minStock: 10,
      },
      {
        name: "Corda de Pular Profissional",
        description: "Corda de pular com rolamento e cabo de aço revestido",
        sku: "ESP-COR-PRO",
        costPrice: 18.0,
        salePrice: 49.9,
        promotionalPrice: 34.9,
        unit: ProductUnit.UN,
        stock: 80,
        minStock: 15,
      },
      {
        name: "Luva de Academia M",
        description: "Luva para musculação com palmeira em gel e velcro",
        sku: "ESP-LUV-M",
        costPrice: 22.0,
        salePrice: 59.9,
        unit: ProductUnit.UN,
        stock: 50,
        minStock: 8,
      },
      {
        name: "Elástico Resistente Kit 3 Unidades",
        description: "Kit com 3 elásticos de resistência progressiva (leve, médio, forte)",
        sku: "ESP-ELA-K3",
        costPrice: 25.0,
        salePrice: 69.9,
        promotionalPrice: 54.9,
        unit: ProductUnit.UN,
        stock: 70,
        minStock: 12,
      },
      {
        name: "Rolo de Espuma Massageador 60cm",
        description: "Foam roller 60cm de alta densidade para recuperação muscular",
        sku: "ESP-ROL-60",
        costPrice: 38.0,
        salePrice: 89.9,
        unit: ProductUnit.UN,
        stock: 30,
        minStock: 5,
      },
      {
        name: "Mochila Esportiva 25L",
        description: "Mochila para academia e trilhas com compartimento para hidratação",
        sku: "ESP-MOC-25L",
        costPrice: 65.0,
        salePrice: 149.9,
        promotionalPrice: 119.9,
        unit: ProductUnit.UN,
        stock: 22,
        minStock: 3,
      },
      {
        name: "Tapete de Yoga Antiderrapante 6mm",
        description: "Tapete de yoga PVC 6mm com alça de transporte",
        sku: "ESP-TAP-YOG",
        costPrice: 45.0,
        salePrice: 109.9,
        promotionalPrice: 89.9,
        unit: ProductUnit.UN,
        stock: 35,
        minStock: 5,
      },
      {
        name: "Meias Esportivas Cano Alto Kit 3 Pares",
        description: "Kit 3 pares de meias esportivas com compressão suave",
        sku: "ESP-MEI-K3",
        costPrice: 20.0,
        salePrice: 49.9,
        promotionalPrice: 39.9,
        unit: ProductUnit.UN,
        stock: 90,
        minStock: 20,
      },
    ],
  },
  {
    name: "Higiene & Beleza",
    slug: "higiene-beleza",
    products: [
      {
        name: "Shampoo Hidratante 400ml",
        description: "Shampoo para cabelos secos e danificados com queratina",
        sku: "HIG-SHA-400",
        costPrice: 12.0,
        salePrice: 29.9,
        promotionalPrice: 22.9,
        unit: ProductUnit.UN,
        stock: 150,
        minStock: 30,
      },
      {
        name: "Condicionador Nutritivo 400ml",
        description: "Condicionador com óleo de argan e pantenol",
        sku: "HIG-CON-400",
        costPrice: 13.0,
        salePrice: 29.9,
        promotionalPrice: 22.9,
        unit: ProductUnit.UN,
        stock: 140,
        minStock: 30,
      },
      {
        name: "Protetor Solar FPS 50 120ml",
        description: "Protetor solar facial e corporal FPS 50 não oleoso",
        sku: "HIG-SOL-120",
        costPrice: 18.0,
        salePrice: 49.9,
        unit: ProductUnit.UN,
        stock: 80,
        minStock: 15,
      },
      {
        name: "Creme Hidratante Corporal 400ml",
        description: "Creme hidratante para o corpo com manteiga de karité",
        sku: "HIG-CRE-400",
        costPrice: 14.0,
        salePrice: 39.9,
        promotionalPrice: 29.9,
        unit: ProductUnit.UN,
        stock: 90,
        minStock: 20,
      },
      {
        name: "Esfoliante Facial 100g",
        description: "Esfoliante facial com micropartículas de bambu",
        sku: "HIG-ESF-100",
        costPrice: 16.0,
        salePrice: 44.9,
        unit: ProductUnit.UN,
        stock: 60,
        minStock: 10,
      },
      {
        name: "Desodorante Roll-On 50ml",
        description: "Desodorante antitranspirante roll-on 48h proteção",
        sku: "HIG-DES-50",
        costPrice: 6.0,
        salePrice: 15.9,
        promotionalPrice: 11.9,
        unit: ProductUnit.UN,
        stock: 200,
        minStock: 40,
      },
      {
        name: "Escova de Dente Bambu",
        description: "Escova dental sustentável de bambu com cerdas macias",
        sku: "HIG-ESC-BAM",
        costPrice: 5.0,
        salePrice: 14.9,
        unit: ProductUnit.UN,
        stock: 180,
        minStock: 40,
      },
      {
        name: "Máscara Capilar Intensiva 300g",
        description: "Máscara de hidratação intensa para cabelos ressecados",
        sku: "HIG-MAS-300",
        costPrice: 19.0,
        salePrice: 54.9,
        promotionalPrice: 42.9,
        unit: ProductUnit.UN,
        stock: 70,
        minStock: 12,
      },
    ],
  },
  {
    name: "Papelaria & Escritório",
    slug: "papelaria-escritorio",
    products: [
      {
        name: "Caneta Esferográfica Azul Kit 12",
        description: "Kit com 12 canetas esferográficas ponta média azul",
        sku: "PAP-CAN-12A",
        costPrice: 8.0,
        salePrice: 19.9,
        promotionalPrice: 14.9,
        unit: ProductUnit.UN,
        stock: 200,
        minStock: 50,
      },
      {
        name: "Caderno Universitário 96 Folhas",
        description: "Caderno universitário 96 folhas capa dura",
        sku: "PAP-CAD-96",
        costPrice: 9.0,
        salePrice: 24.9,
        unit: ProductUnit.UN,
        stock: 120,
        minStock: 20,
      },
      {
        name: "Post-it 76x76mm 100 Folhas",
        description: "Bloco de notas adesivas 76x76mm com 100 folhas",
        sku: "PAP-POS-76",
        costPrice: 7.0,
        salePrice: 18.9,
        promotionalPrice: 13.9,
        unit: ProductUnit.UN,
        stock: 160,
        minStock: 30,
      },
      {
        name: "Grampeador de Mesa 26/6",
        description: "Grampeador metálico para até 20 folhas com grampos inclusos",
        sku: "PAP-GRA-26",
        costPrice: 15.0,
        salePrice: 39.9,
        unit: ProductUnit.UN,
        stock: 45,
        minStock: 8,
      },
      {
        name: "Pasta Arquivo com Aba 25mm",
        description: "Pasta arquivo em cartão com aba e elástico, dorso 25mm",
        sku: "PAP-PAS-25",
        costPrice: 5.0,
        salePrice: 14.9,
        promotionalPrice: 10.9,
        unit: ProductUnit.UN,
        stock: 300,
        minStock: 50,
      },
      {
        name: "Calculadora de Mesa 12 Dígitos",
        description: "Calculadora científica de mesa com alimentação solar e bateria",
        sku: "PAP-CAL-12",
        costPrice: 25.0,
        salePrice: 59.9,
        unit: ProductUnit.UN,
        stock: 35,
        minStock: 5,
      },
      {
        name: "Marca Texto Kit 5 Cores",
        description: "Kit com 5 canetas marca texto em cores sortidas",
        sku: "PAP-MAR-K5",
        costPrice: 10.0,
        salePrice: 25.9,
        promotionalPrice: 18.9,
        unit: ProductUnit.UN,
        stock: 130,
        minStock: 25,
      },
      {
        name: "Fichário A4 4 Argolas 65mm",
        description: "Fichário A4 com 4 argolas redondas de 65mm e capa dura",
        sku: "PAP-FIC-65",
        costPrice: 22.0,
        salePrice: 54.9,
        unit: ProductUnit.UN,
        stock: 40,
        minStock: 8,
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

async function main() {
  console.log("🌱 Seed: 40 produtos promocionais...\n");

  const organization = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
    include: {
      members: { orderBy: { createdAt: "asc" }, take: 1 },
    },
  });

  if (!organization) {
    throw new Error("❌ Nenhuma organização encontrada.");
  }

  const createdById =
    organization.members[0]?.userId ??
    (await prisma.user.findFirst({ orderBy: { createdAt: "asc" } }))?.id;

  if (!createdById) {
    throw new Error("❌ Nenhum usuário encontrado.");
  }

  console.log(`🏢 Organização: ${organization.name}`);
  console.log(`👤 Criador: ${createdById}\n`);

  const orgId = organization.id;
  let total = 0;
  let promoCount = 0;

  for (const cat of CATEGORIES) {
    const category = await prisma.category.upsert({
      where: { organizationId_slug: { organizationId: orgId, slug: cat.slug } },
      update: {},
      create: { organizationId: orgId, name: cat.name, slug: cat.slug, isActive: true },
    });
    console.log(`📂 ${category.name}`);

    for (const item of cat.products) {
      const slug = slugify(item.name);

      const product = await prisma.product.upsert({
        where: { organizationId_slug: { organizationId: orgId, slug } },
        update: {},
        create: {
          organizationId: orgId,
          categoryId: category.id,
          name: item.name,
          slug,
          description: item.description,
          sku: item.sku,
          costPrice: item.costPrice,
          salePrice: item.salePrice,
          ...(item.promotionalPrice !== undefined && {
            promotionalPrice: item.promotionalPrice,
          }),
          unit: item.unit,
          currentStock: item.stock,
          minStock: item.minStock,
          thumbnail: THUMB,
          images: [THUMB],
          isActive: true,
          trackStock: true,
          createdById,
        },
      });

      await prisma.stockMovement.create({
        data: {
          organizationId: orgId,
          productId: product.id,
          type: MovementType.ENTRADA,
          quantity: item.stock,
          previousStock: 0,
          newStock: item.stock,
          unitCost: item.costPrice,
          notes: "Estoque inicial (seed promo)",
          createdById,
        },
      });

      const promo = item.promotionalPrice
        ? ` → promo R$ ${item.promotionalPrice.toFixed(2)}`
        : "";
      console.log(
        `  ✅ ${item.name} — R$ ${item.salePrice.toFixed(2)}${promo} — estoque: ${item.stock}`,
      );

      total++;
      if (item.promotionalPrice) promoCount++;
    }
    console.log();
  }

  console.log(
    `✨ ${total} produtos criados (${promoCount} com preço promocional, ${total - promoCount} sem).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
