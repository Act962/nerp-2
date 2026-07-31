import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Seed do "modo control center" — popula os 8 painéis do dashboard da org
// com o mesmo layout do mockup ORBITA. Usa métricas manuais para KPIs que
// não têm data source nativa correspondente (Caminhões em Op., OTIF,
// Aproveitamento da Frota, etc.).
//
// Idempotente: rerodar RECRIA os painéis do control-center (`templateKey`
// prefixado com `cc-`), preservando outros painéis que o admin tenha
// adicionado à mão.

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Alvo: org Gotham (onde o dev está logado). Antes mirava a demo
// "distribuidora-demo"; agora popula direto o dashboard da org real de teste.
const ORG_ID = "SX99VyjCVlkXq8R9uTGC05bTTaoywraV";

// Paleta do mockup — cores vivas, saturadas (não a paleta pastel do NERP).
// Uso hex livre (o campo `color` já aceita hex pelo conta-gotas).
const C = {
  blue: "#3b82f6",
  emerald: "#10b981",
  amber: "#f59e0b",
  red: "#ef4444",
  violet: "#8b5cf6",
  cyan: "#06b6d4",
  pink: "#ec4899",
  slate: "#64748b",
  indigo: "#6366f1",
  teal: "#14b8a6",
};

interface ManualMetricSeed {
  slug: string; // usado só pra dedupe local
  label: string;
  value: number;
  unit: "currency" | "number" | "percent";
}

// Métricas manuais que representam os KPIs do mockup. Uso `slug` como chave
// de dedupe (não é campo no banco — DashboardManualMetric não tem slug).
// Rerodar apaga e recria só as métricas com esses labels.
const MANUAL_METRICS: ManualMetricSeed[] = [
  {
    slug: "faturamento-hoje",
    label: "Faturamento hoje",
    value: 3250000,
    unit: "currency",
  },
  { slug: "pedidos-hoje", label: "Pedidos hoje", value: 4287, unit: "number" },
  {
    slug: "caminhoes-operacao",
    label: "Caminhões em operação",
    value: 164,
    unit: "number",
  },
  {
    slug: "estoque-total",
    label: "Estoque total (R$)",
    value: 29430000,
    unit: "currency",
  },
  {
    slug: "clientes-atendidos",
    label: "Clientes atendidos",
    value: 1247,
    unit: "number",
  },
  {
    slug: "otif",
    label: "Nível de serviço (OTIF)",
    value: 97.3,
    unit: "percent",
  },
  {
    slug: "meta-realizado-pct",
    label: "Meta atingida (%)",
    value: 78,
    unit: "percent",
  },
  { slug: "meta-total", label: "Meta", value: 9800000, unit: "currency" },
  {
    slug: "meta-realizado",
    label: "Realizado",
    value: 7650000,
    unit: "currency",
  },
  { slug: "conversao", label: "Conversão", value: 23.7, unit: "percent" },
  {
    slug: "ticket-medio-cc",
    label: "Ticket médio",
    value: 756.8,
    unit: "currency",
  },
  { slug: "positivacao", label: "Positivação", value: 88.6, unit: "percent" },
  { slug: "carregando", label: "Carregando", value: 24, unit: "number" },
  { slug: "em-rota", label: "Em rota", value: 98, unit: "number" },
  {
    slug: "aguardando-conf",
    label: "Aguardando conf.",
    value: 18,
    unit: "number",
  },
  { slug: "em-atraso", label: "Em atraso", value: 7, unit: "number" },
  {
    slug: "aproveitamento-frota",
    label: "Aproveitamento da frota",
    value: 91,
    unit: "percent",
  },
  { slug: "entregas-hoje", label: "Entregas hoje", value: 128, unit: "number" },
  { slug: "margem-bruta", label: "Margem bruta", value: 22.8, unit: "percent" },
  {
    slug: "inadimplencia",
    label: "Inadimplência",
    value: 2.14,
    unit: "percent",
  },
  {
    slug: "recebimentos-mes",
    label: "Recebimentos (mês)",
    value: 8450000,
    unit: "currency",
  },
  {
    slug: "lucro-diario",
    label: "Lucro diário",
    value: 287540,
    unit: "currency",
  },
  {
    slug: "custos-logisticos",
    label: "Custos logísticos",
    value: 543210,
    unit: "currency",
  },
  { slug: "ocupacao-cd", label: "Ocupação do CD", value: 72, unit: "percent" },
  { slug: "giro-medio", label: "Giro médio", value: 5.2, unit: "number" },
  { slug: "rupturas", label: "Rupturas (R$)", value: 346000, unit: "currency" },
];

interface WidgetSeed {
  metricSlug?: string; // usa manual metric criada acima
  dataSourceKey?: string; // ou keys nativas do WIDGET_REGISTRY
  title: string;
  displayType: "STAT" | "CHART" | "LIST" | "MAP" | "TABLE";
  chartKind?: "LINE" | "BAR" | "DONUT";
  color?: string;
  icon?: string;
  options?: Record<string, unknown>;
}

interface PanelSeed {
  templateKey: string;
  category: string;
  title: string;
  color: string;
  widgets: WidgetSeed[];
}

// Layout do mockup mapeado em painéis. Cada widget vira um card no grid do
// painel; o WidgetsTab do editor renderiza como 1/2/3 colunas conforme
// largura.
const PANELS: PanelSeed[] = [
  {
    templateKey: "cc-kpis-topo",
    category: "operacional",
    title: "KPIs do dia",
    color: C.slate,
    widgets: [
      {
        metricSlug: "faturamento-hoje",
        title: "Faturamento hoje",
        displayType: "STAT",
        color: C.emerald,
        icon: "TrendingUp",
      },
      {
        metricSlug: "pedidos-hoje",
        title: "Pedidos hoje",
        displayType: "STAT",
        color: C.blue,
        icon: "ShoppingCart",
      },
      {
        metricSlug: "caminhoes-operacao",
        title: "Caminhões em operação",
        displayType: "STAT",
        color: C.amber,
        icon: "Truck",
      },
      {
        metricSlug: "estoque-total",
        title: "Estoque total",
        displayType: "STAT",
        color: C.violet,
        icon: "Package",
      },
      {
        metricSlug: "clientes-atendidos",
        title: "Clientes atendidos",
        displayType: "STAT",
        color: C.cyan,
        icon: "Users",
      },
      {
        metricSlug: "otif",
        title: "Nível de serviço (OTIF)",
        displayType: "STAT",
        color: C.emerald,
        icon: "Target",
      },
    ],
  },
  {
    templateKey: "cc-comercial",
    category: "comercial",
    title: "Comercial",
    color: C.indigo,
    widgets: [
      // Meta grande com progress ring hero (com sparkline visual atrás — StatWidget lê `options.sparkline`)
      {
        metricSlug: "meta-realizado",
        title: "Meta x realizado",
        displayType: "STAT",
        color: C.indigo,
        icon: "Target",
        options: {
          targetValue: 9800000,
          appearance: {
            valueSize: "xl",
            valueWeight: "bold",
            valueColor: "#a5b4fc",
          },
          sparkline: [55, 58, 62, 65, 70, 74, 78],
        },
      },
      {
        metricSlug: "conversao",
        title: "Conversão",
        displayType: "STAT",
        color: C.indigo,
        options: { sparkline: [18, 20, 21, 22, 23, 23.5, 23.7] },
      },
      {
        metricSlug: "ticket-medio-cc",
        title: "Ticket médio",
        displayType: "STAT",
        color: C.indigo,
        options: { sparkline: [720, 730, 740, 745, 750, 754, 756.8] },
      },
      {
        metricSlug: "positivacao",
        title: "Positivação",
        displayType: "STAT",
        color: C.indigo,
        options: { sparkline: [80, 82, 84, 86, 87, 88, 88.6] },
      },
      {
        dataSourceKey: "ranking.teamRankingTop",
        title: "Ranking de vendedores (top 5)",
        displayType: "LIST",
        color: C.indigo,
      },
      {
        dataSourceKey: "native.avgTicket",
        title: "Ticket médio (real)",
        displayType: "STAT",
        color: C.indigo,
      },
    ],
  },
  {
    templateKey: "cc-estoque",
    category: "estoque",
    title: "Estoque",
    color: C.emerald,
    widgets: [
      {
        metricSlug: "ocupacao-cd",
        title: "Ocupação do CD",
        displayType: "STAT",
        color: C.emerald,
        options: { sparkline: [65, 68, 70, 71, 72, 72, 72] },
      },
      {
        metricSlug: "giro-medio",
        title: "Giro médio",
        displayType: "STAT",
        color: C.emerald,
      },
      {
        metricSlug: "rupturas",
        title: "Rupturas",
        displayType: "STAT",
        color: C.red,
        icon: "AlertTriangle",
      },
      {
        dataSourceKey: "native.lowStockCount",
        title: "Produtos em ruptura",
        displayType: "STAT",
        color: C.red,
      },
      {
        dataSourceKey: "native.lowStockList",
        title: "Top rupturas",
        displayType: "LIST",
        color: C.emerald,
      },
      {
        dataSourceKey: "native.stockMovementsTrend",
        title: "Movimentação — últimos dias",
        displayType: "CHART",
        chartKind: "LINE",
        color: C.emerald,
      },
    ],
  },
  {
    templateKey: "cc-logistica",
    category: "logistica",
    title: "Logística — status das entregas",
    color: C.blue,
    widgets: [
      {
        metricSlug: "carregando",
        title: "Carregando",
        displayType: "STAT",
        color: C.blue,
        icon: "Truck",
      },
      {
        metricSlug: "em-rota",
        title: "Em rota",
        displayType: "STAT",
        color: C.emerald,
        icon: "Truck",
      },
      {
        metricSlug: "aguardando-conf",
        title: "Aguardando conf.",
        displayType: "STAT",
        color: C.amber,
        icon: "Clock",
      },
      {
        metricSlug: "em-atraso",
        title: "Em atraso",
        displayType: "STAT",
        color: C.red,
        icon: "AlertTriangle",
      },
      {
        metricSlug: "aproveitamento-frota",
        title: "Aproveitamento da frota",
        displayType: "STAT",
        color: C.blue,
        options: { targetValue: 100, sparkline: [82, 84, 86, 88, 89, 90, 91] },
      },
      {
        metricSlug: "entregas-hoje",
        title: "Entregas hoje",
        displayType: "STAT",
        color: C.blue,
        options: { targetValue: 200 },
      },
    ],
  },
  {
    templateKey: "cc-mapa",
    category: "mapa",
    title: "Mapa de operações",
    color: C.cyan,
    widgets: [
      // Mapa de rotas com marcadores não existe. Usa o coroplético do Piauí.
      {
        dataSourceKey: "geo.salesByPiauiMunicipio",
        title: "Vendas por município (Piauí)",
        displayType: "MAP",
        color: C.cyan,
      },
    ],
  },
  {
    templateKey: "cc-financeiro",
    category: "financeiro",
    title: "Financeiro",
    color: C.teal,
    widgets: [
      {
        metricSlug: "margem-bruta",
        title: "Margem bruta",
        displayType: "STAT",
        color: C.teal,
        icon: "Percent",
        options: { sparkline: [21, 21.5, 22, 22.3, 22.5, 22.6, 22.8] },
      },
      {
        metricSlug: "inadimplencia",
        title: "Inadimplência",
        displayType: "STAT",
        color: C.amber,
        icon: "AlertTriangle",
      },
      {
        metricSlug: "recebimentos-mes",
        title: "Recebimentos (mês)",
        displayType: "STAT",
        color: C.emerald,
        icon: "Wallet",
        options: {
          sparkline: [
            7200000, 7500000, 7900000, 8100000, 8250000, 8380000, 8450000,
          ],
        },
      },
      {
        metricSlug: "lucro-diario",
        title: "Lucro diário",
        displayType: "STAT",
        color: C.teal,
        icon: "DollarSign",
        options: {
          sparkline: [230000, 245000, 260000, 268000, 275000, 282000, 287540],
        },
      },
      {
        metricSlug: "custos-logisticos",
        title: "Custos logísticos",
        displayType: "STAT",
        color: C.red,
        icon: "Truck",
        options: {
          sparkline: [580000, 570000, 560000, 555000, 550000, 545000, 543210],
        },
      },
    ],
  },
  {
    templateKey: "cc-ia",
    category: "ia",
    title: "IA operacional",
    color: C.pink,
    widgets: [
      {
        dataSourceKey: "content.feed",
        title: "Alertas da IA",
        displayType: "LIST",
        color: C.pink,
        options: {
          content: {
            kind: "feed",
            items: [
              {
                id: "a1",
                tone: "danger",
                title: "Caminhão PIA-8F23 parado há 42 minutos",
                subtitle: "Em posto BR-343 — Campo Maior/PI",
                time: "14:32",
              },
              {
                id: "a2",
                tone: "warning",
                title: "Estoque de SUCO UVA 1L acaba em 2 dias",
                subtitle: "Estoque atual: 48 un.",
                time: "14:28",
              },
              {
                id: "a3",
                tone: "success",
                title: "Vendas 18% acima da semana passada",
                subtitle: "Excelente desempenho. Mantenha o ritmo.",
                time: "14:20",
              },
              {
                id: "a4",
                tone: "warning",
                title: "Risco de atraso em 7 entregas",
                subtitle: "Verifique rotas com previsão de atraso",
                time: "14:18",
              },
              {
                id: "a5",
                tone: "info",
                title: "João Silva é o melhor vendedor do dia",
                subtitle: "R$ 685.430 em vendas",
                time: "14:15",
              },
            ],
          },
        },
      },
    ],
  },
  {
    templateKey: "cc-frota",
    category: "frota",
    title: "Frota — situação dos caminhões",
    color: C.amber,
    widgets: [
      {
        dataSourceKey: "content.fleet",
        title: "Situação dos caminhões",
        displayType: "TABLE",
        color: C.amber,
        options: {
          content: {
            kind: "fleet",
            trucks: [
              {
                id: "t1",
                plate: "PIA-8F23",
                driver: "João da Silva",
                route: "Teresina → Fortaleza/CE",
                loadPercent: 100,
                eta: "16:20",
                status: "Em rota",
                statusTone: "success",
              },
              {
                id: "t2",
                plate: "PIV-2H71",
                driver: "Carlos Lima",
                route: "Teresina → Parnaíba/PI",
                loadPercent: 98,
                eta: "14:10",
                status: "Em rota",
                statusTone: "success",
              },
              {
                id: "t3",
                plate: "PIX-1A82",
                driver: "Rafael Souza",
                route: "Teresina → Picos/PI",
                loadPercent: 85,
                eta: "17:30",
                status: "Em rota",
                statusTone: "success",
              },
              {
                id: "t4",
                plate: "PIY-7D34",
                driver: "Marcos Paulo",
                route: "Teresina → Floriano/PI",
                loadPercent: 100,
                eta: "18:40",
                status: "Carregando",
                statusTone: "info",
              },
              {
                id: "t5",
                plate: "PIZ-3K55",
                driver: "Fernando Alves",
                route: "Teresina → São Luís/MA",
                loadPercent: 92,
                eta: "20:10",
                status: "Aguard. conf.",
                statusTone: "warning",
              },
              {
                id: "t6",
                plate: "PIW-9L88",
                driver: "Alex Santos",
                route: "Teresina → Imperatriz/MA",
                loadPercent: 75,
                eta: "13:50",
                status: "Em atraso",
                statusTone: "danger",
              },
              {
                id: "t7",
                plate: "PIF-6M21",
                driver: "Daniel Ferreira",
                route: "Teresina → Bom Jesus/PI",
                loadPercent: 60,
                eta: "16:40",
                status: "Em atraso",
                statusTone: "danger",
              },
              {
                id: "t8",
                plate: "PIK-4J19",
                driver: "Lucas Andrade",
                route: "Teresina → Oeiras/PI",
                loadPercent: 40,
                eta: "15:30",
                status: "Carregando",
                statusTone: "info",
              },
            ],
          },
        },
      },
    ],
  },
];

async function main() {
  console.log("🌱 seed control-center");

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: ORG_ID },
  });
  console.log(`🏢 org: ${org.name} (${org.id})`);

  // Garante o dashboard da org (cria vazio se ainda não existe).
  const dashboard = await prisma.orgDashboard.upsert({
    where: { organizationId: org.id },
    update: {},
    create: { organizationId: org.id },
  });

  // 1) Métricas manuais — upsert por (organizationId, label). Não há unique
  // no schema, então faço deleteMany + createMany.
  await prisma.dashboardManualMetric.deleteMany({
    where: {
      organizationId: org.id,
      label: { in: MANUAL_METRICS.map((metric) => metric.label) },
    },
  });
  const createdMetrics = await Promise.all(
    MANUAL_METRICS.map((metric) =>
      prisma.dashboardManualMetric.create({
        data: {
          organizationId: org.id,
          label: metric.label,
          value: metric.value,
          unit: metric.unit,
        },
      }),
    ),
  );
  const metricIdBySlug = new Map(
    MANUAL_METRICS.map((metric, index) => [
      metric.slug,
      createdMetrics[index].id,
    ]),
  );
  console.log(`📏 ${createdMetrics.length} métricas manuais`);

  // 2) Painéis — apaga só os do control-center (templateKey prefix `cc-`)
  // pra preservar painéis feitos à mão pelo admin.
  await prisma.orgDashboardPanel.deleteMany({
    where: {
      orgDashboardId: dashboard.id,
      templateKey: { startsWith: "cc-" },
    },
  });

  const defaultLayout = {
    lg: { x: 0, y: 0, w: 3, h: 2 },
    md: { x: 0, y: 0, w: 3, h: 2 },
    sm: { x: 0, y: 0, w: 4, h: 2 },
  };

  for (const [index, panel] of PANELS.entries()) {
    const created = await prisma.orgDashboardPanel.create({
      data: {
        orgDashboardId: dashboard.id,
        category: panel.category,
        title: panel.title,
        color: panel.color,
        sortOrder: index,
        templateKey: panel.templateKey,
      },
    });

    for (const [widgetIndex, widget] of panel.widgets.entries()) {
      const dataSourceKey =
        widget.dataSourceKey ??
        (widget.metricSlug
          ? `manual.${metricIdBySlug.get(widget.metricSlug)}`
          : null);
      if (!dataSourceKey) continue;

      await prisma.orgDashboardWidget.create({
        data: {
          orgDashboardId: dashboard.id,
          panelId: created.id,
          dataSourceKey,
          title: widget.title,
          displayType: widget.displayType,
          chartKind: widget.chartKind ?? null,
          color: widget.color ?? null,
          icon: widget.icon ?? null,
          options: (widget.options ?? undefined) as never,
          layout: defaultLayout,
          sortOrder: widgetIndex,
        },
      });
    }
    console.log(`🧩 painel ${panel.title} (${panel.widgets.length} widgets)`);
  }

  console.log("\n✅ control-center populado.");
  console.log("Abra: http://localhost:3000/dashboard-organizacao");
}

main()
  .catch((error) => {
    console.error("❌", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
