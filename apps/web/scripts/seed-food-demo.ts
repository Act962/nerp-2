/**
 * Salão de food service cheio, para ver o módulo funcionando de uma vez.
 *
 * Cria cardápio, garçons, mesas e um salão com TODOS os estados ao mesmo tempo:
 * mesa consumindo, mesa com item pronto (que alimenta a TV), mesa pedindo a
 * conta, ticket esperando aceite (que acende a barra "Novos pedidos") e ticket
 * aceito ainda não impresso (que enche a fila da estação de impressão).
 *
 * As FOTOS são as genéricas de `public/exemplo/` — as mesmas que o onboarding
 * usa. Não são fotos de hambúrguer: servem só para a tela ser julgada com
 * imagem, já que o leiaute foi desenhado em volta dela.
 *
 * Reexecutável: apaga o que ele mesmo criou (ticket com prefixo `demo-food-`)
 * antes de recriar, e faz upsert de categoria, produto, mesa e colaborador.
 *
 *   SEED_DATABASE_URL="postgres://…" pnpm exec tsx scripts/seed-food-demo.ts <slug-da-org>
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@/generated/prisma/client";
import { SaleStatus } from "@/generated/prisma/enums";

// Conexão explícita: o `.env.local` do worktree pode apontar para outro banco e
// vencer o `.env`, então sem isto o seed escreve no lugar errado.
const connectionString = process.env.SEED_DATABASE_URL;
if (!connectionString) {
  throw new Error("Defina SEED_DATABASE_URL antes de rodar o seed.");
}
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const PREFIXO = "demo-food-";

const CATEGORIAS = [
  { slug: "food-burgers", name: "Burgers", order: 0 },
  { slug: "food-porcoes", name: "Porções", order: 1 },
  { slug: "food-bebidas", name: "Bebidas", order: 2 },
  { slug: "food-sobremesas", name: "Sobremesas", order: 3 },
];

const PRODUTOS = [
  {
    slug: "x-salada",
    name: "X-Salada da casa",
    preco: 25,
    preparo: 12,
    categoria: "food-burgers",
    foto: "/exemplo/produto-2.jpg",
  },
  {
    slug: "x-bacon",
    name: "X-Bacon duplo",
    preco: 32,
    preparo: 15,
    categoria: "food-burgers",
    foto: "/exemplo/produto-3.jpg",
  },
  {
    slug: "x-tudo",
    name: "X-Tudo",
    preco: 38,
    preparo: 18,
    categoria: "food-burgers",
    foto: "/exemplo/produto-4.jpg",
  },
  {
    slug: "hot-dog",
    name: "Hot dog completo",
    preco: 16,
    preparo: 10,
    categoria: "food-burgers",
    foto: "/exemplo/produto-5.jpg",
  },
  {
    slug: "batata-frita",
    name: "Batata frita grande",
    preco: 18,
    preparo: 8,
    categoria: "food-porcoes",
    foto: "/exemplo/produto-6.jpg",
  },
  {
    slug: "onion-rings",
    name: "Onion rings",
    preco: 20,
    preparo: 9,
    categoria: "food-porcoes",
    foto: "/exemplo/produto-7.jpg",
  },
  {
    slug: "refri-lata",
    name: "Refrigerante lata",
    preco: 7,
    preparo: null,
    categoria: "food-bebidas",
    foto: "/exemplo/produto-8.jpg",
  },
  {
    slug: "suco-natural",
    name: "Suco natural 500ml",
    preco: 12,
    preparo: 4,
    categoria: "food-bebidas",
    foto: "/exemplo/produto-9.jpg",
  },
  {
    slug: "cerveja-long-neck",
    name: "Cerveja long neck",
    preco: 12,
    preparo: null,
    categoria: "food-bebidas",
    foto: "/exemplo/produto-10.jpg",
  },
  {
    slug: "milkshake",
    name: "Milkshake de chocolate",
    preco: 19,
    preparo: 6,
    categoria: "food-sobremesas",
    foto: "/exemplo/produto-11.jpg",
  },
];

const GARCONS = ["Zé Carlos", "Ana Beatriz", "Marcos"];

async function main() {
  const slug = process.argv[2] ?? process.env.SEED_ORG_SLUG;
  if (!slug) {
    const orgs = await prisma.organization.findMany({
      select: { slug: true, name: true },
      take: 20,
    });
    throw new Error(
      `Informe o slug da organização. Disponíveis:\n${orgs
        .map((o) => `  ${o.slug}  (${o.name})`)
        .join("\n")}`,
    );
  }

  const org = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
  if (!org) throw new Error(`Organização "${slug}" não encontrada.`);
  // Fora do objeto: dentro da função `abrirMesa` o TypeScript perde o
  // estreitamento do `org` e volta a achar que pode ser nulo.
  const organizationId = org.id;

  // `Product.createdById` é obrigatório no schema, então sem dono não há como
  // semear cardápio nenhum — melhor dizer isso do que falhar lá na frente com
  // um erro de constraint.
  const dono = await prisma.member.findFirst({
    where: { organizationId, role: { in: ["owner", "admin"] } },
    select: { userId: true },
  });
  if (!dono) {
    throw new Error(
      `A organização "${slug}" não tem dono nem administrador; o cardápio precisa de um criador.`,
    );
  }

  console.log(`Semeando o salão de ${org.name}…`);

  // ---------------------------------------------------------------- limpeza
  const apagados = await prisma.kitchenOrder.deleteMany({
    where: {
      organizationId: organizationId,
      ticketId: { startsWith: PREFIXO },
    },
  });
  await prisma.sale.deleteMany({
    where: {
      organizationId: organizationId,
      notes: { startsWith: "[demo-food]" },
    },
  });
  if (apagados.count > 0) {
    console.log(`  limpou ${apagados.count} pedidos da rodada anterior`);
  }

  // ------------------------------------------------------------- cardápio
  const categoriaPorSlug = new Map<string, string>();
  for (const categoria of CATEGORIAS) {
    const linha = await prisma.category.upsert({
      where: {
        organizationId_slug: {
          organizationId: organizationId,
          slug: categoria.slug,
        },
      },
      create: { organizationId: organizationId, ...categoria, isDemo: true },
      update: {},
      select: { id: true },
    });
    categoriaPorSlug.set(categoria.slug, linha.id);
  }

  const produtoPorSlug = new Map<
    string,
    { id: string; name: string; preco: number; preparo: number | null }
  >();
  for (const produto of PRODUTOS) {
    const linha = await prisma.product.upsert({
      where: {
        organizationId_slug: {
          organizationId: organizationId,
          slug: produto.slug,
        },
      },
      create: {
        organizationId: organizationId,
        createdById: dono.userId,
        name: produto.name,
        slug: produto.slug,
        salePrice: produto.preco,
        costPrice: produto.preco / 2,
        prepTimeMinutes: produto.preparo,
        categoryId: categoriaPorSlug.get(produto.categoria) ?? null,
        thumbnail: produto.foto,
        images: [produto.foto],
        trackStock: false,
        showInCatalog: true,
        isDemo: true,
      },
      update: {
        salePrice: produto.preco,
        prepTimeMinutes: produto.preparo,
        thumbnail: produto.foto,
        showInCatalog: true,
      },
      select: { id: true, name: true },
    });
    produtoPorSlug.set(produto.slug, {
      id: linha.id,
      name: linha.name,
      preco: produto.preco,
      preparo: produto.preparo,
    });
  }
  console.log(`  ${PRODUTOS.length} itens no cardápio`);

  // ------------------------------------------------------------ garçons
  const colaboradores: { id: string; name: string; photoUrl: string | null }[] =
    [];
  for (const nome of GARCONS) {
    const existente = await prisma.collaborator.findFirst({
      where: { organizationId: organizationId, name: nome },
      select: { id: true, name: true, photoUrl: true },
    });
    colaboradores.push(
      existente ??
        (await prisma.collaborator.create({
          data: { organizationId: organizationId, name: nome, role: "Garçom" },
          select: { id: true, name: true, photoUrl: true },
        })),
    );
  }
  console.log(`  ${colaboradores.length} garçons`);

  // -------------------------------------------------------------- mesas
  const existentes = await prisma.serviceTable.findMany({
    where: { organizationId: organizationId },
    select: { number: true },
  });
  const jaTem = new Set(existentes.map((m) => m.number));
  const novas = [];
  for (let n = 1; n <= 12; n++) {
    if (jaTem.has(n)) continue;
    novas.push({
      organizationId: organizationId,
      number: n,
      seats: 4,
      qrToken: randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, ""),
    });
  }
  if (novas.length > 0) await prisma.serviceTable.createMany({ data: novas });

  const mesas = await prisma.serviceTable.findMany({
    where: { organizationId: organizationId },
    orderBy: { number: "asc" },
    select: { id: true, number: true },
  });
  const mesaPorNumero = new Map(mesas.map((m) => [m.number, m]));
  console.log(`  ${mesas.length} mesas (${novas.length} criadas agora)`);

  // ------------------------------------------------------------- colunas
  const colunas = await prisma.kitchenColumn.findMany({
    where: { organizationId: organizationId },
    orderBy: { position: "asc" },
    select: {
      id: true,
      name: true,
      isInitial: true,
      showOnTv: true,
      isFinal: true,
    },
  });
  const inicial = colunas.find((c) => c.isInitial) ?? colunas[0];
  const pronta = colunas.find((c) => c.showOnTv) ?? inicial;
  if (!inicial) throw new Error("A organização não tem colunas na cozinha.");

  // ------------------------------------------------------------ cenários
  let posicao = 0;
  const agora = Date.now();

  async function abrirMesa({
    numeroDaMesa,
    itens,
    garcom,
    minutosAtras,
    coluna,
    aceito,
    impresso,
    pedindoConta,
  }: {
    numeroDaMesa: number;
    itens: { slug: string; quantidade: number; observacao?: string }[];
    garcom: { id: string; name: string; photoUrl: string | null };
    minutosAtras: number;
    coluna: { id: string };
    aceito: boolean;
    impresso: boolean;
    pedindoConta?: boolean;
  }) {
    const mesa = mesaPorNumero.get(numeroDaMesa);
    if (!mesa) return;

    const quando = new Date(agora - minutosAtras * 60_000);
    const ticketId = `${PREFIXO}${randomUUID()}`;

    const linhas = itens.map((item) => {
      const produto = produtoPorSlug.get(item.slug);
      if (!produto) throw new Error(`Produto ${item.slug} não semeado`);
      return { ...item, produto };
    });

    const subtotal = linhas.reduce(
      (soma, l) => soma + l.produto.preco * l.quantidade,
      0,
    );

    const numero = await prisma.organization.update({
      where: { id: organizationId },
      data: { lastSaleNumber: { increment: 1 } },
      select: { lastSaleNumber: true },
    });

    const venda = await prisma.sale.create({
      data: {
        organizationId: organizationId,
        saleNumber: numero.lastSaleNumber,
        status: SaleStatus.PENDING_APPROVAL,
        subtotal,
        total: subtotal,
        createdAt: quando,
        notes: `[demo-food] Mesa ${numeroDaMesa} · ${garcom.name}`,
        items: {
          createMany: {
            data: linhas.map((l) => ({
              productId: l.produto.id,
              productName: l.produto.name,
              quantity: l.quantidade,
              unitPrice: l.produto.preco,
              total: l.produto.preco * l.quantidade,
              notes: l.observacao ?? null,
            })),
          },
        },
      },
      select: { id: true },
    });

    await prisma.kitchenOrder.createMany({
      data: linhas.map((l) => ({
        organizationId: organizationId,
        columnId: coluna.id,
        tableId: mesa.id,
        saleId: venda.id,
        ticketId,
        tableNumber: `Mesa ${numeroDaMesa}`,
        dishName:
          l.quantidade > 1
            ? `${l.quantidade}x ${l.produto.name}`
            : l.produto.name,
        productId: l.produto.id,
        estimatedMinutes: l.produto.preparo,
        notes: l.observacao ?? null,
        attendantId: garcom.id,
        attendantName: garcom.name,
        attendantPhoto: garcom.photoUrl,
        position: posicao++,
        createdAt: quando,
        columnEnteredAt: quando,
        acceptedAt: aceito ? quando : null,
        printedAt: impresso ? quando : null,
      })),
    });

    if (pedindoConta) {
      await prisma.serviceTable.update({
        where: { id: mesa.id },
        data: { closingRequestedAt: new Date(agora - 2 * 60_000) },
      });
    } else {
      await prisma.serviceTable.update({
        where: { id: mesa.id },
        data: { closingRequestedAt: null },
      });
    }
  }

  // Mesa consumindo, já impressa — o caso comum do salão.
  await abrirMesa({
    numeroDaMesa: 1,
    itens: [
      { slug: "x-bacon", quantidade: 2, observacao: "sem cebola" },
      { slug: "batata-frita", quantidade: 1 },
      { slug: "refri-lata", quantidade: 2 },
    ],
    garcom: colaboradores[0],
    minutosAtras: 38,
    coluna: inicial,
    aceito: true,
    impresso: true,
  });

  // Mesa com o pedido PRONTO: é o que aparece no painel da TV.
  await abrirMesa({
    numeroDaMesa: 5,
    itens: [
      { slug: "x-tudo", quantidade: 1, observacao: "ponto da carne ao ponto" },
      { slug: "milkshake", quantidade: 1 },
    ],
    garcom: colaboradores[1],
    minutosAtras: 21,
    coluna: pronta,
    aceito: true,
    impresso: true,
  });

  // Mesa pedindo a conta — fica azul na grade e avisa o caixa.
  await abrirMesa({
    numeroDaMesa: 7,
    itens: [
      { slug: "hot-dog", quantidade: 3 },
      { slug: "cerveja-long-neck", quantidade: 4 },
    ],
    garcom: colaboradores[2],
    minutosAtras: 64,
    coluna: inicial,
    aceito: true,
    impresso: true,
    pedindoConta: true,
  });

  // Aceito e NÃO impresso: enche a fila da estação de impressão.
  await abrirMesa({
    numeroDaMesa: 9,
    itens: [
      { slug: "x-salada", quantidade: 1, observacao: "capricha no molho" },
      { slug: "onion-rings", quantidade: 1 },
    ],
    garcom: colaboradores[0],
    minutosAtras: 3,
    coluna: inicial,
    aceito: true,
    impresso: false,
  });

  // ------------------------------------- pedido do cardápio, sem aceite
  // Sem mesa: quem pede pelo link do Instagram não senta no salão. É ele que
  // acende a barra "Novos pedidos" no board.
  const cliente = await prisma.customer.upsert({
    where: {
      organizationId_email: {
        organizationId: organizationId,
        email: "joao.demo@exemplo.local",
      },
    },
    create: {
      organizationId: organizationId,
      name: "João da Silva",
      phone: "86999990000",
      email: "joao.demo@exemplo.local",
      notes: "[demo-food] Cliente do cardápio",
      isDemo: true,
    },
    update: {},
    select: { id: true, name: true },
  });

  const itensDoCardapio = [
    { slug: "x-tudo", quantidade: 1, observacao: "sem picles" },
    { slug: "batata-frita", quantidade: 1 },
    { slug: "suco-natural", quantidade: 2 },
  ];
  const linhasCardapio = itensDoCardapio.map((item) => {
    const produto = produtoPorSlug.get(item.slug);
    if (!produto) throw new Error(`Produto ${item.slug} não semeado`);
    return { ...item, produto };
  });
  const subtotalCardapio = linhasCardapio.reduce(
    (soma, l) => soma + l.produto.preco * l.quantidade,
    0,
  );

  const numeroCardapio = await prisma.organization.update({
    where: { id: organizationId },
    data: { lastSaleNumber: { increment: 1 } },
    select: { lastSaleNumber: true },
  });

  const vendaCardapio = await prisma.sale.create({
    data: {
      organizationId: organizationId,
      customerId: cliente.id,
      saleNumber: numeroCardapio.lastSaleNumber,
      status: SaleStatus.PENDING_APPROVAL,
      subtotal: subtotalCardapio,
      total: subtotalCardapio,
      notes: "[demo-food] vou buscar em 20 minutos",
      items: {
        createMany: {
          data: linhasCardapio.map((l) => ({
            productId: l.produto.id,
            productName: l.produto.name,
            quantity: l.quantidade,
            unitPrice: l.produto.preco,
            total: l.produto.preco * l.quantidade,
            notes: l.observacao ?? null,
          })),
        },
      },
    },
    select: { id: true, saleNumber: true },
  });

  // UM ticket para o pedido inteiro. Gerado dentro do `map`, cada item ganharia
  // o seu, e o pedido apareceria na tela como três pedidos diferentes do mesmo
  // cliente — cada um cobrando o total da venda.
  const ticketDoCardapio = `${PREFIXO}${randomUUID()}`;

  await prisma.kitchenOrder.createMany({
    data: linhasCardapio.map((l) => ({
      organizationId: organizationId,
      columnId: inicial.id,
      saleId: vendaCardapio.id,
      ticketId: ticketDoCardapio,
      tableNumber: `Pedido #${vendaCardapio.saleNumber} · ${cliente.name}`,
      dishName:
        l.quantidade > 1
          ? `${l.quantidade}x ${l.produto.name}`
          : l.produto.name,
      productId: l.produto.id,
      estimatedMinutes: l.produto.preparo,
      notes: l.observacao ?? null,
      position: posicao++,
      acceptedAt: null,
      printedAt: null,
    })),
  });

  console.log(`
Pronto. O que olhar:
  /pedidos            board com a barra "Novos pedidos" (pedido do João, aguardando aceite)
  /pedidos/mesas      12 mesas; 1 e 9 consumindo, 5 com pedido pronto, 7 pedindo a conta
  /pedidos/garcom     app do garçom — a grade colorida
  /pedidos/painel     painel da TV — a mesa 5 está pronta
  /pedidos/impressao  1 ticket na fila (mesa 9)
`);

  await prisma.$disconnect();
}

main().catch(async (erro) => {
  console.error(erro instanceof Error ? erro.message : erro);
  await prisma.$disconnect();
  process.exit(1);
});
