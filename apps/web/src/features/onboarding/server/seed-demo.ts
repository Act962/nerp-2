import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { DEFAULT_CONFIG } from "@/features/promotional-catalog/types";
import type { PacoteDeExemplo } from "../lib/nichos";

type PrismaLike = typeof prisma;

/**
 * Dados de exemplo para a organização recém-criada.
 *
 * A pessoa entra e já encontra produtos com foto e preço, clientes,
 * fornecedores com logo, uma loja e um catálogo promocional montado — dá para
 * abrir cada tela e entender o que ela faz sem cadastrar nada antes. Tudo
 * nasce com `isDemo: true`: não conta no limite do plano e some inteiro com
 * "Remover dados de exemplo".
 *
 * Idempotente pelo mesmo motivo de `ensureTradeCatalogs`: se a criação da org
 * repetir o hook, ou se um backfill chamar isto para uma org antiga, não
 * duplica.
 *
 * As fotos moram em `public/exemplo/` — caminho absoluto, que `constructUrl`
 * devolve intacto: dado semeado não depende do bucket estar de pé.
 */

const CATEGORIAS = [
  { slug: "demo-cafes", name: "Cafés", order: 0 },
  { slug: "demo-bebidas", name: "Bebidas e refrescos", order: 1 },
  { slug: "demo-mercearia", name: "Mercearia", order: 2 },
] as const;

type SlugDeCategoria = (typeof CATEGORIAS)[number]["slug"];

const PRODUTOS: {
  sku: string;
  slug: string;
  name: string;
  categoria: SlugDeCategoria;
  costPrice: string;
  salePrice: string;
  promotionalPrice?: string;
  currentStock: number;
  minStock: number;
  barcode: string;
  foto: string;
  description: string;
}[] = [
  {
    sku: "DEMO-001",
    slug: "cafe-santa-clara-extraforte-250g",
    name: "Café Santa Clara Extraforte 250g",
    categoria: "demo-cafes",
    costPrice: "9.80",
    salePrice: "13.99",
    currentStock: 48,
    minStock: 12,
    barcode: "7896224900010",
    foto: "/exemplo/produto-3.jpg",
    description: "Café torrado e moído, torra extraforte.",
  },
  {
    sku: "DEMO-002",
    slug: "cafe-santa-clara-classico-soluvel-40g",
    name: "Café Santa Clara Clássico solúvel 40g",
    categoria: "demo-cafes",
    costPrice: "3.60",
    salePrice: "5.49",
    currentStock: 36,
    minStock: 10,
    barcode: "7896224900027",
    foto: "/exemplo/produto-4.jpg",
    description: "Café solúvel granulado, rende cerca de 40 xícaras.",
  },
  {
    sku: "DEMO-003",
    slug: "cafe-com-leite-santa-clara-300g",
    name: "Café com Leite Santa Clara 300g",
    categoria: "demo-cafes",
    costPrice: "11.20",
    salePrice: "15.99",
    promotionalPrice: "13.99",
    currentStock: 20,
    minStock: 6,
    barcode: "7896224900034",
    foto: "/exemplo/produto-5.jpg",
    description: "Pó para preparo de café com leite, fonte de cálcio.",
  },
  {
    sku: "DEMO-004",
    slug: "cappuccino-santa-clara-200g",
    name: "Cappuccino Santa Clara 200g",
    categoria: "demo-cafes",
    costPrice: "9.90",
    salePrice: "13.99",
    currentStock: 15,
    minStock: 5,
    barcode: "7896224900041",
    foto: "/exemplo/produto-6.jpg",
    description: "Cappuccino pronto, cremoso.",
  },
  {
    sku: "DEMO-005",
    slug: "capsulas-tres-3-coracoes-10-un",
    name: "Cápsulas TRES 3 Corações (10 un)",
    categoria: "demo-cafes",
    costPrice: "13.50",
    salePrice: "18.99",
    currentStock: 8,
    minStock: 10,
    barcode: "7896224900058",
    foto: "/exemplo/produto-7.jpg",
    description: "Caixa com 10 cápsulas para máquina TRES.",
  },
  {
    sku: "DEMO-006",
    slug: "refil-kimimo-40g",
    name: "Refil de café solúvel Kimimo 40g",
    categoria: "demo-cafes",
    costPrice: "3.10",
    salePrice: "4.99",
    currentStock: 60,
    minStock: 15,
    barcode: "7896224900065",
    foto: "/exemplo/produto-10.jpg",
    description: "Café solúvel granulado forte e encorpado, refil.",
  },
  {
    sku: "DEMO-007",
    slug: "achocolatado-chocolatto-3-coracoes-700g",
    name: "Achocolatado Chocolatto 3 Corações 700g",
    categoria: "demo-bebidas",
    costPrice: "11.40",
    salePrice: "15.99",
    promotionalPrice: "14.49",
    currentStock: 25,
    minStock: 8,
    barcode: "7896224900072",
    foto: "/exemplo/produto-2.jpg",
    description: "Achocolatado em pó, embalagem econômica.",
  },
  {
    sku: "DEMO-008",
    slug: "power-whey-3-coracoes-250ml",
    name: "Power Whey 3 Corações 250ml",
    categoria: "demo-bebidas",
    costPrice: "4.70",
    salePrice: "6.99",
    currentStock: 30,
    minStock: 12,
    barcode: "7896224900089",
    foto: "/exemplo/produto-9.jpg",
    description: "Bebida láctea com café, 15 g de proteína.",
  },
  {
    sku: "DEMO-009",
    slug: "refresco-frisco-18g",
    name: "Refresco em pó Frisco 18g",
    categoria: "demo-bebidas",
    costPrice: "0.45",
    salePrice: "0.85",
    currentStock: 200,
    minStock: 50,
    barcode: "7896224900096",
    foto: "/exemplo/produto-11.jpg",
    description: "Preparado sólido para refresco, faz 1 litro.",
  },
  {
    sku: "DEMO-010",
    slug: "flocao-de-milho-dona-clara-500g",
    name: "Flocão de milho Dona Clara Premium 500g",
    categoria: "demo-mercearia",
    costPrice: "1.10",
    salePrice: "1.79",
    currentStock: 90,
    minStock: 24,
    barcode: "7896224900102",
    foto: "/exemplo/produto-8.jpg",
    description: "Farinha de milho flocada, sem glúten.",
  },
];

const FORNECEDORES = [
  {
    name: "Distribuidora Santa Clara (exemplo)",
    tradeName: "Santa Clara",
    logo: "/brands/nestle.svg",
    city: "Fortaleza",
    state: "CE",
    contactPerson: "Ana Ribeiro",
    phone: "(85) 3000-0001",
    email: "comercial@santaclara.exemplo",
  },
  {
    name: "3 Corações Atacado (exemplo)",
    tradeName: "3 Corações",
    logo: "/brands/coca-cola.svg",
    city: "Eusébio",
    state: "CE",
    contactPerson: "Carlos Melo",
    phone: "(85) 3000-0002",
    email: "vendas@3coracoes.exemplo",
  },
  {
    name: "Bebidas do Norte (exemplo)",
    tradeName: "Bebidas do Norte",
    logo: "/brands/unilever.svg",
    city: "Teresina",
    state: "PI",
    contactPerson: "Marina Costa",
    phone: "(86) 3000-0003",
    email: "pedidos@bebidasdonorte.exemplo",
  },
];

const CLIENTES = [
  {
    name: "Mercadinho do Bairro (exemplo)",
    personType: "JURIDICA" as const,
    email: "cliente1@exemplo.demo",
    phone: "(85) 99000-0001",
    city: "Fortaleza",
    state: "CE",
  },
  {
    name: "Padaria Pão Quente (exemplo)",
    personType: "JURIDICA" as const,
    email: "cliente2@exemplo.demo",
    phone: "(85) 99000-0002",
    city: "Caucaia",
    state: "CE",
  },
  {
    name: "Maria Souza",
    personType: "FISICA" as const,
    email: "cliente3@exemplo.demo",
    phone: "(85) 99000-0003",
    city: "Fortaleza",
    state: "CE",
  },
  {
    name: "João Pereira",
    personType: "FISICA" as const,
    email: "cliente4@exemplo.demo",
    phone: "(85) 99000-0004",
    city: "Maracanaú",
    state: "CE",
  },
  {
    name: "Lanchonete Central (exemplo)",
    personType: "JURIDICA" as const,
    email: "cliente5@exemplo.demo",
    phone: "(85) 99000-0005",
    city: "Fortaleza",
    state: "CE",
  },
];

export interface ResultadoDoSeed {
  criou: boolean;
}

export async function seedDemoDataForOrg(
  organizationId: string,
  userId: string,
  client: PrismaLike = prisma,
  // Por enquanto há um pacote só (mercearia, com fotos reais); os outros
  // nichos caem nele até terem fotos próprias. O parâmetro já existe para a
  // escolha ficar em `nichos.ts`, não aqui.
  _pacote: PacoteDeExemplo = "mercearia",
): Promise<ResultadoDoSeed> {
  const jaTem = await client.product.count({
    where: { organizationId, isDemo: true },
  });
  if (jaTem > 0) return { criou: false };

  // Categorias: upsert pelo slug único da org, para um seed interrompido no
  // meio poder ser reexecutado sem duplicar.
  const categoriaPorSlug = new Map<SlugDeCategoria, string>();
  for (const categoria of CATEGORIAS) {
    const linha = await client.category.upsert({
      where: {
        organizationId_slug: { organizationId, slug: categoria.slug },
      },
      create: {
        organizationId,
        name: categoria.name,
        slug: categoria.slug,
        order: categoria.order,
        isDemo: true,
      },
      update: { isDemo: true },
      select: { id: true },
    });
    categoriaPorSlug.set(categoria.slug, linha.id);
  }

  const fornecedores = await Promise.all(
    FORNECEDORES.map((fornecedor) =>
      client.supplier.create({
        data: { ...fornecedor, organizationId, isDemo: true },
        select: { id: true },
      }),
    ),
  );

  const produtos: { id: string }[] = [];
  for (const [indice, produto] of PRODUTOS.entries()) {
    const { categoria, foto, ...campos } = produto;
    const linha = await client.product.upsert({
      where: { organizationId_slug: { organizationId, slug: produto.slug } },
      create: {
        ...campos,
        organizationId,
        createdById: userId,
        categoryId: categoriaPorSlug.get(categoria) ?? null,
        supplierId: fornecedores[indice % fornecedores.length]?.id ?? null,
        thumbnail: foto,
        images: [foto],
        isDemo: true,
      },
      update: { isDemo: true },
      select: { id: true },
    });
    produtos.push(linha);
  }

  for (const cliente of CLIENTES) {
    await client.customer.upsert({
      where: { organizationId_email: { organizationId, email: cliente.email } },
      create: { ...cliente, organizationId, isDemo: true },
      update: { isDemo: true },
    });
  }

  await client.store.create({
    data: {
      organizationId,
      name: "Loja Centro (exemplo)",
      code: "DEMO-01",
      managerName: "Paulo Lima",
      address: "Rua das Flores, 100",
      city: "Fortaleza",
      state: "CE",
      customersPerDay: 320,
      isDemo: true,
    },
  });

  // O catálogo já vem com fundo e com os produtos em promoção: é a tela que
  // mais impressiona de primeira, e vazia não diz nada.
  const config: Prisma.InputJsonValue = {
    ...DEFAULT_CONFIG,
    title: "Ofertas da semana",
    showTitle: true,
    subtitle: "Válidas enquanto durarem os estoques",
    backgroundColor: "#fff7ed",
    backgroundGradient: { from: "#fff7ed", to: "#fed7aa", angle: 160 },
    cardColor: "#ffffff",
    manuallyAddedIds: produtos.map((produto) => produto.id),
    sortBy: "discount-desc",
    footerText: "Catálogo de exemplo — edite à vontade.",
  } as unknown as Prisma.InputJsonValue;

  await client.promotionalCatalog.create({
    data: {
      organizationId,
      createdById: userId,
      name: "Ofertas da semana (exemplo)",
      config,
      isDemo: true,
    },
  });

  return { criou: true };
}
