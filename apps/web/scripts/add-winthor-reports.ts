import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { ORACLE_QUERY_TEMPLATES } from "@/features/dashboard-widgets/lib/oracle-query-templates";

// Adiciona (não-destrutivo) um painel "Comercial — Winthor" ao dashboard da
// org Gotham com os dois relatórios (146 supervisor, 114 RCA) já configurados
// como widgets Oracle. Só recria o painel `cc-winthor` — não toca nos demais.
//
// IMPORTANTE: este script só GRAVA a configuração. Nenhuma conexão Oracle é
// aberta aqui — a resolução (contra o Winthor real) acontece quando alguém
// ABRE o dashboard, no servidor, com cache de snapshot.

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const ORG_ID = "SX99VyjCVlkXq8R9uTGC05bTTaoywraV";
const PANEL_TEMPLATE_KEY = "cc-winthor";

function template(key: string) {
  const found = ORACLE_QUERY_TEMPLATES.find((t) => t.key === key);
  if (!found) throw new Error(`Template ${key} não encontrado`);
  return found;
}

async function main() {
  const dashboard = await prisma.orgDashboard.upsert({
    where: { organizationId: ORG_ID },
    update: {},
    create: { organizationId: ORG_ID },
    select: { id: true },
  });

  // Reset só do painel deste script.
  await prisma.orgDashboardPanel.deleteMany({
    where: { orgDashboardId: dashboard.id, templateKey: PANEL_TEMPLATE_KEY },
  });

  const maxSort = await prisma.orgDashboardPanel.aggregate({
    where: { orgDashboardId: dashboard.id },
    _max: { sortOrder: true },
  });

  const panel = await prisma.orgDashboardPanel.create({
    data: {
      orgDashboardId: dashboard.id,
      category: "comercial",
      title: "Comercial — Winthor (146 / 114)",
      color: "#6366f1",
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      templateKey: PANEL_TEMPLATE_KEY,
    },
    select: { id: true },
  });

  // `report.costKey`: índice da coluna de custo no resultado (M0=venda...).
  // 146: [venda,pedidos,RCAs,ticket,custo] → custo=M4.
  // 114: [venda,ped,médio,custo]           → custo=M3.
  const reports = [
    {
      key: "resumo-por-supervisor",
      title: "146 — Resumo por supervisor",
      w: 6,
      costKey: "M4",
    },
    {
      key: "ranking-rca-detalhado",
      title: "114 — Ranking de RCAs",
      w: 6,
      costKey: "M3",
    },
  ];

  for (const [index, report] of reports.entries()) {
    const tpl = template(report.key);
    const layout = {
      lg: { x: index * 6, y: 0, w: report.w, h: 4 },
      md: { x: 0, y: index * 4, w: 8, h: 4 },
      sm: { x: 0, y: index * 4, w: 4, h: 4 },
    };
    await prisma.orgDashboardWidget.create({
      data: {
        orgDashboardId: dashboard.id,
        panelId: panel.id,
        dataSourceKey: "oracle.custom",
        title: report.title,
        displayType: "TABLE",
        color: "#6366f1",
        options: {
          oracle: tpl.config,
          // Deriva % Part., % Acum., Contrib. e % Lucro no front.
          report: { valueKey: "M0", costKey: report.costKey },
        } as never,
        layout: layout as never,
        sortOrder: index,
      },
    });
    console.log(`🧩 ${report.title}`);
  }

  console.log("\n✅ painel 'Comercial — Winthor' adicionado à Gotham.");
  console.log(
    "Os widgets resolvem contra o Winthor real ao abrir o dashboard (em produção).",
  );
}

main()
  .catch((e) => {
    console.error("❌", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
