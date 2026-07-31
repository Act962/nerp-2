import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
// @ts-expect-error — node16 module resolution não acha o .js subpath em tsc,
// mas Node resolve em runtime.
import { scryptAsync } from "@noble/hashes/scrypt.js";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@/generated/prisma/client";

// Seed dedicado para ver o Dashboard da Organização funcionando end-to-end.
// Cria uma org nova, um owner com senha (hashada no formato do Better Auth),
// dados nativos suficientes para os widgets renderem (categoria + produtos,
// que alimentam `native.productsActive`, `native.lowStockCount`, etc.) e um
// OrgDashboard com 2 painéis já populados (Comercial + Estoque) para você
// entrar no `/dashboard-organizacao` e ver painéis prontos.
//
// Idempotente por email: rodar de novo NÃO duplica.

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEMO = {
  email: "duascarasnasa@gmail.com",
  password: "NerpDev@2026",
  name: "Weydson (dev local)",
  orgName: "Distribuidora Demo",
  orgSlug: "distribuidora-demo",
};

// scrypt idêntico ao usado pelo Better Auth (crypto/password.mjs) — se um dia
// eles mudarem os parâmetros, este seed precisa acompanhar.
const SCRYPT = { N: 16384, r: 16, p: 1, dkLen: 64 };

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function hashPassword(password: string): Promise<string> {
  const saltBytes = new Uint8Array(randomBytes(16));
  const salt = toHex(saltBytes);
  const key = await scryptAsync(password.normalize("NFKC"), salt, {
    ...SCRYPT,
    maxmem: 128 * SCRYPT.N * SCRYPT.r * 2,
  });
  return `${salt}:${toHex(key)}`;
}

async function main() {
  console.log("🌱 seed org-dashboard-demo");

  // ---- Usuário + credencial ----
  const existingUser = await prisma.user.findUnique({
    where: { email: DEMO.email },
  });
  const user =
    existingUser ??
    (await prisma.user.create({
      data: {
        name: DEMO.name,
        email: DEMO.email,
        emailVerified: true,
      },
    }));
  console.log(`👤 usuário: ${user.email} (${user.id})`);

  const existingAccount = await prisma.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
  });
  if (!existingAccount) {
    await prisma.account.create({
      data: {
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: await hashPassword(DEMO.password),
      },
    });
    console.log(`🔐 senha configurada: ${DEMO.password}`);
  } else {
    // Rerodar reseta a senha — dá pra rodar de novo se você esquecer.
    await prisma.account.update({
      where: { id: existingAccount.id },
      data: { password: await hashPassword(DEMO.password) },
    });
    console.log(`🔐 senha REDEFINIDA: ${DEMO.password}`);
  }

  // ---- Organização ----
  const existingOrg = await prisma.organization.findFirst({
    where: { slug: DEMO.orgSlug },
  });
  const org =
    existingOrg ??
    (await prisma.organization.create({
      data: {
        name: DEMO.orgName,
        slug: DEMO.orgSlug,
      },
    }));
  console.log(`🏢 org: ${org.name} (${org.id})`);

  const existingMember = await prisma.member.findFirst({
    where: { userId: user.id, organizationId: org.id },
  });
  if (!existingMember) {
    await prisma.member.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        role: "owner",
      },
    });
    console.log("👑 membership: owner");
  }

  // ---- Dados básicos para os widgets nativos renderem ----
  const category = await prisma.category.upsert({
    where: {
      organizationId_slug: { organizationId: org.id, slug: "demo" },
    },
    update: {},
    create: {
      organizationId: org.id,
      name: "Demo",
      slug: "demo",
      isActive: true,
      order: 1,
    },
  });

  const productSeeds = [
    { name: "Notebook Demo", slug: "notebook-demo", sku: "NB-DEMO", salePrice: 4990, currentStock: 12 },
    { name: "Monitor 27", slug: "monitor-27", sku: "MON-27", salePrice: 1890, currentStock: 5 },
    { name: "Teclado Mecânico", slug: "teclado-mec", sku: "KEY-01", salePrice: 799, currentStock: 1 },
    { name: "Mouse Sem Fio", slug: "mouse-sf", sku: "MOU-01", salePrice: 249, currentStock: 0 },
  ];
  for (const seed of productSeeds) {
    await prisma.product.upsert({
      where: {
        organizationId_slug: { organizationId: org.id, slug: seed.slug },
      },
      update: {},
      create: {
        organizationId: org.id,
        categoryId: category.id,
        createdById: user.id,
        name: seed.name,
        slug: seed.slug,
        sku: seed.sku,
        salePrice: seed.salePrice,
        currentStock: seed.currentStock,
        minStock: 3,
        isActive: true,
      },
    });
  }
  console.log(`📦 ${productSeeds.length} produtos`);

  // ---- OrgDashboard + 2 painéis populados ----
  const memberRow = await prisma.member.findFirstOrThrow({
    where: { userId: user.id, organizationId: org.id },
    select: { id: true },
  });

  const dashboard = await prisma.orgDashboard.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id,
      createdById: memberRow.id,
    },
  });
  console.log(`🎛️  OrgDashboard (${dashboard.id})`);

  // Reset dos painéis do seed pra o script ser rerunável.
  await prisma.orgDashboardPanel.deleteMany({
    where: { orgDashboardId: dashboard.id, templateKey: { in: ["comercial-basico", "estoque-basico"] } },
  });

  const defaultLayout = {
    lg: { x: 0, y: 0, w: 3, h: 2 },
    md: { x: 0, y: 0, w: 3, h: 2 },
    sm: { x: 0, y: 0, w: 4, h: 2 },
  };

  const comercial = await prisma.orgDashboardPanel.create({
    data: {
      orgDashboardId: dashboard.id,
      category: "comercial",
      title: "Comercial — visão geral",
      color: "#6366f1",
      sortOrder: 0,
      templateKey: "comercial-basico",
    },
  });
  const comercialWidgets = [
    { dataSourceKey: "ranking.orgGoalVsAchieved", title: "Meta x realizado", displayType: "STAT" },
    { dataSourceKey: "ranking.teamRankingTop", title: "Ranking de vendedores", displayType: "LIST" },
    { dataSourceKey: "native.avgTicket", title: "Ticket médio", displayType: "STAT" },
    { dataSourceKey: "native.salesTotal", title: "Faturamento", displayType: "STAT" },
  ];
  for (const [index, widget] of comercialWidgets.entries()) {
    await prisma.orgDashboardWidget.create({
      data: {
        orgDashboardId: dashboard.id,
        panelId: comercial.id,
        dataSourceKey: widget.dataSourceKey,
        title: widget.title,
        displayType: widget.displayType as never,
        layout: defaultLayout,
        sortOrder: index,
      },
    });
  }

  const estoque = await prisma.orgDashboardPanel.create({
    data: {
      orgDashboardId: dashboard.id,
      category: "estoque",
      title: "Estoque — panorama",
      color: "#10b981",
      sortOrder: 1,
      templateKey: "estoque-basico",
    },
  });
  const estoqueWidgets = [
    { dataSourceKey: "native.productsActive", title: "Produtos ativos", displayType: "STAT" },
    { dataSourceKey: "native.lowStockCount", title: "Em ruptura", displayType: "STAT" },
    { dataSourceKey: "native.lowStockList", title: "Top rupturas", displayType: "LIST" },
  ];
  for (const [index, widget] of estoqueWidgets.entries()) {
    await prisma.orgDashboardWidget.create({
      data: {
        orgDashboardId: dashboard.id,
        panelId: estoque.id,
        dataSourceKey: widget.dataSourceKey,
        title: widget.title,
        displayType: widget.displayType as never,
        layout: defaultLayout,
        sortOrder: index,
      },
    });
  }

  console.log("🧩 2 painéis populados (Comercial, Estoque)");

  console.log("\n✅ pronto!\n");
  console.log("Login local:");
  console.log(`  email: ${DEMO.email}`);
  console.log(`  senha: ${DEMO.password}`);
  console.log(`  org:   ${DEMO.orgName}\n`);
  console.log(
    "Abra http://localhost:3000/login, entre com essas credenciais, e navegue para /dashboard-organizacao.",
  );
}

main()
  .catch((error) => {
    console.error("❌ seed falhou:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
