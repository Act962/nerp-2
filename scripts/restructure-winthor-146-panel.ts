import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { ORACLE_QUERY_TEMPLATES } from "@/features/dashboard-widgets/lib/oracle-query-templates";

// Reestrutura o painel "Comercial — Winthor (146/114)" da Gotham: de duas
// tabelas soltas lado a lado para uma "melhor estrutura" — tira de KPIs
// (STAT), gráfico comparativo por supervisor, e as duas tabelas detalhadas
// abaixo. Painel vira largura cheia (o conteúdo agora é mais rico).
//
// Idempotente: apaga e recria só os widgets DESTE painel (templateKey
// `cc-winthor`) — não toca nos outros painéis da Gotham.

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const ORG_ID = "SX99VyjCVlkXq8R9uTGC05bTTaoywraV";
const PANEL_TEMPLATE_KEY = "cc-winthor";
const ACCENT = "#6366f1";

function template(key: string) {
  const found = ORACLE_QUERY_TEMPLATES.find((t) => t.key === key);
  if (!found) throw new Error(`Template ${key} não encontrado`);
  return found;
}

interface WidgetSeed {
  templateKey: string;
  title: string;
  displayType: "STAT" | "CHART" | "LIST" | "TABLE";
  chartKind?: "LINE" | "BAR" | "DONUT";
  layout: { x: number; y: number; w: number; h: number };
  /** Só a tabela 146 recebe: deriva % Part./Contrib./% Lucro/% MC/% Acum. */
  report?: { valueKey: string; costKey: string };
}

// Grade interna do painel: 12 colunas (breakpoint 'lg' de PANEL_WIDGET_BREAKPOINTS).
// Linha 0: 4 KPIs lado a lado. Linha 2: gráfico full-width. Linha 6: as duas
// tabelas detalhadas, lado a lado.
const WIDGETS: WidgetSeed[] = [
  {
    templateKey: "vl-venda-mes",
    title: "Vl. venda (mês)",
    displayType: "STAT",
    layout: { x: 0, y: 0, w: 3, h: 2 },
  },
  {
    templateKey: "qt-pedidos-mes",
    title: "Qt. pedidos (mês)",
    displayType: "STAT",
    layout: { x: 3, y: 0, w: 3, h: 2 },
  },
  {
    templateKey: "vl-medio-pedido-mes",
    title: "Vl. médio pedido",
    displayType: "STAT",
    layout: { x: 6, y: 0, w: 3, h: 2 },
  },
  {
    templateKey: "custo-mes",
    title: "Custo (mês)",
    displayType: "STAT",
    layout: { x: 9, y: 0, w: 3, h: 2 },
  },
  {
    templateKey: "vendas-por-supervisor-chart",
    title: "Vendas por supervisor",
    displayType: "CHART",
    chartKind: "BAR",
    layout: { x: 0, y: 2, w: 12, h: 4 },
  },
  {
    templateKey: "resumo-por-supervisor",
    title: "146 — Resumo por supervisor",
    displayType: "TABLE",
    layout: { x: 0, y: 6, w: 6, h: 5 },
    // Custo agora é M3 — "Qt RCAs" (COUNT_DISTINCT) foi removida do template,
    // então o índice das medidas seguintes andou uma casa pra trás.
    report: { valueKey: "M0", costKey: "M3" },
  },
  {
    templateKey: "ranking-rca-detalhado",
    title: "114 — Ranking de RCAs",
    displayType: "TABLE",
    layout: { x: 6, y: 6, w: 6, h: 5 },
    report: { valueKey: "M0", costKey: "M3" },
  },
];

async function main() {
  const dashboard = await prisma.orgDashboard.findUnique({
    where: { organizationId: ORG_ID },
    select: { id: true },
  });
  if (!dashboard) throw new Error("OrgDashboard não encontrado para a Gotham");

  const panel = await prisma.orgDashboardPanel.findFirst({
    where: { orgDashboardId: dashboard.id, templateKey: PANEL_TEMPLATE_KEY },
    select: { id: true, layout: true },
  });
  if (!panel) throw new Error(`Painel ${PANEL_TEMPLATE_KEY} não encontrado`);

  // Painel em largura cheia — o conteúdo agora é rico o bastante pra
  // justificar (KPIs + gráfico + 2 tabelas), mantendo a MESMA posição Y
  // (topo) que já tinha, só ajustando largura e altura.
  const currentLayout = panel.layout as Record<
    string,
    { x: number; y: number; w: number; h: number }
  > | null;
  const y = currentLayout?.lg?.y ?? 0;
  await prisma.orgDashboardPanel.update({
    where: { id: panel.id },
    data: {
      title: "Comercial — Vendas por supervisor (Winthor 146 / 114)",
      layout: {
        lg: { x: 0, y, w: 12, h: 12 },
        md: { x: 0, y, w: 8, h: 12 },
        sm: { x: 0, y, w: 4, h: 12 },
      },
    },
  });

  await prisma.orgDashboardWidget.deleteMany({ where: { panelId: panel.id } });

  const defaultItem = { x: 0, y: 0, w: 3, h: 2 };
  for (const [index, widget] of WIDGETS.entries()) {
    const tpl = template(widget.templateKey);
    const options: Record<string, unknown> = { oracle: tpl.config };
    if (widget.report) options.report = widget.report;

    await prisma.orgDashboardWidget.create({
      data: {
        orgDashboardId: dashboard.id,
        panelId: panel.id,
        dataSourceKey: "oracle.custom",
        title: widget.title,
        displayType: widget.displayType,
        chartKind: widget.chartKind ?? null,
        color: ACCENT,
        options: options as never,
        layout: {
          lg: widget.layout,
          md: widget.layout,
          sm: { ...defaultItem, w: Math.min(widget.layout.w, 4) },
        } as never,
        sortOrder: index,
      },
    });
    console.log(`🧩 ${widget.title}`);
  }

  console.log("\n✅ painel reestruturado: KPIs + gráfico + 2 tabelas.");
}

main()
  .catch((error) => {
    console.error("❌", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
