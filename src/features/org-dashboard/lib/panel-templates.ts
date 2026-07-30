// Templates de painel — categorias pré-configuradas com um conjunto de
// widgets padrão. O admin clica "Adicionar painel de X" e o painel nasce
// preenchido; ele pode ajustar/remover/adicionar widgets depois.
//
// Widget referencia `dataSourceKey` do WIDGET_REGISTRY (dashboard pessoal
// e org compartilham o mesmo catálogo). Templates que dependem do Oracle
// (financeiro, logística detalhada) usam `oracle.custom` como marcador — o
// admin abre o widget depois e configura a consulta contra o Winthor
// específico da org. Sem isso, o template seria útil só em orgs que já têm
// snapshot dessas consultas.

export type PanelCategoryKey =
  | "comercial"
  | "estoque"
  | "frota"
  | "logistica"
  | "operacional"
  | "financeiro"
  | "mapa"
  | "ia";

export interface PanelCategoryDef {
  key: PanelCategoryKey;
  label: string;
  /** Cor padrão do cabeçalho do painel (hex). Admin pode sobrescrever. */
  defaultColor: string;
  /** Descrição curta para tooltip no picker de painel. */
  description: string;
}

export const PANEL_CATEGORIES: PanelCategoryDef[] = [
  {
    key: "comercial",
    label: "Comercial",
    defaultColor: "#6366f1", // indigo — meta/venda
    description: "Meta, ranking de vendedores, ticket médio, curva ABC.",
  },
  {
    key: "estoque",
    label: "Estoque",
    defaultColor: "#10b981", // emerald — abundância/verde
    description: "Ocupação, giro, rupturas, produtos próximos da validade.",
  },
  {
    key: "frota",
    label: "Frota",
    defaultColor: "#f59e0b", // amber
    description: "Caminhões em operação, situação da frota, ocupação de carga.",
  },
  {
    key: "logistica",
    label: "Logística",
    defaultColor: "#3b82f6", // blue — em rota
    description:
      "Status das entregas: carregando, em rota, aguardando, em atraso.",
  },
  {
    key: "operacional",
    label: "Operacional",
    defaultColor: "#8b5cf6", // violet
    description: "Nível de serviço (OTIF), aproveitamento, produtividade.",
  },
  {
    key: "financeiro",
    label: "Financeiro",
    defaultColor: "#14b8a6", // teal — dinheiro
    description: "Margem, inadimplência, recebimentos, fluxo de caixa.",
  },
  {
    key: "mapa",
    label: "Mapa de operações",
    defaultColor: "#0891b2", // cyan
    description: "Mapa geográfico das vendas/entregas por região.",
  },
  {
    key: "ia",
    label: "IA operacional",
    defaultColor: "#ec4899", // pink — alerta destacado
    description: "Alertas gerados por regras e observações automáticas.",
  },
];

export interface PanelTemplateWidget {
  dataSourceKey: string;
  title?: string;
  displayType: "STAT" | "CHART" | "LIST" | "MAP" | "TABLE";
  chartKind?: "LINE" | "BAR" | "DONUT";
  options?: Record<string, unknown>;
}

export interface PanelTemplate {
  key: string;
  category: PanelCategoryKey;
  label: string;
  description: string;
  widgets: PanelTemplateWidget[];
}

// Templates são "kits" — pré-selecionados para o admin não começar do zero.
// Widget de Oracle vem VAZIO (`oracle: null`) para o admin abrir e configurar
// a consulta contra o Winthor dele; sem isso o preflight recusaria.
export const PANEL_TEMPLATES: PanelTemplate[] = [
  {
    key: "comercial-basico",
    category: "comercial",
    label: "Comercial — visão geral",
    description: "Meta, ranking de vendedores, ticket médio.",
    widgets: [
      {
        dataSourceKey: "ranking.orgGoalVsAchieved",
        title: "Meta x realizado",
        displayType: "STAT",
      },
      {
        dataSourceKey: "ranking.teamRankingTop",
        title: "Ranking de vendedores",
        displayType: "LIST",
      },
      {
        dataSourceKey: "native.avgTicket",
        title: "Ticket médio",
        displayType: "STAT",
      },
      {
        dataSourceKey: "native.salesTotal",
        title: "Faturamento",
        displayType: "STAT",
      },
    ],
  },
  {
    key: "estoque-basico",
    category: "estoque",
    label: "Estoque — panorama",
    description: "Produtos ativos, ruptura e movimentação.",
    widgets: [
      {
        dataSourceKey: "native.productsActive",
        title: "Produtos ativos",
        displayType: "STAT",
      },
      {
        dataSourceKey: "native.lowStockCount",
        title: "Em ruptura",
        displayType: "STAT",
      },
      {
        dataSourceKey: "native.lowStockList",
        title: "Top rupturas",
        displayType: "LIST",
      },
      {
        dataSourceKey: "native.stockMovementsTrend",
        title: "Movimentação por dia",
        displayType: "CHART",
        chartKind: "LINE",
      },
    ],
  },
  {
    key: "frota-basico",
    category: "frota",
    label: "Frota — situação (via Oracle)",
    description:
      "Caminhões em operação e situação da frota. Requer configurar as consultas Oracle no primeiro uso.",
    widgets: [
      {
        dataSourceKey: "oracle.custom",
        title: "Caminhões em operação",
        displayType: "STAT",
      },
      {
        dataSourceKey: "oracle.custom",
        title: "Situação da frota",
        displayType: "TABLE",
      },
    ],
  },
  {
    key: "logistica-status",
    category: "logistica",
    label: "Logística — status das entregas",
    description:
      "4 cards: carregando, em rota, aguardando, em atraso. Requer Oracle.",
    widgets: [
      {
        dataSourceKey: "oracle.custom",
        title: "Carregando",
        displayType: "STAT",
      },
      {
        dataSourceKey: "oracle.custom",
        title: "Em rota",
        displayType: "STAT",
      },
      {
        dataSourceKey: "oracle.custom",
        title: "Aguardando",
        displayType: "STAT",
      },
      {
        dataSourceKey: "oracle.custom",
        title: "Em atraso",
        displayType: "STAT",
      },
    ],
  },
  {
    key: "operacional-otif",
    category: "operacional",
    label: "Operacional — OTIF",
    description:
      "Nível de serviço, atraso médio, aproveitamento. Requer Oracle.",
    widgets: [
      {
        dataSourceKey: "oracle.custom",
        title: "Nível de serviço (OTIF)",
        displayType: "STAT",
      },
      {
        dataSourceKey: "oracle.custom",
        title: "Atraso médio",
        displayType: "STAT",
      },
      {
        dataSourceKey: "oracle.custom",
        title: "Aproveitamento da frota",
        displayType: "STAT",
      },
    ],
  },
  {
    key: "financeiro-basico",
    category: "financeiro",
    label: "Financeiro — panorama",
    description:
      "Margem, inadimplência, recebimentos, custos. Todos usam Oracle — configure cada consulta.",
    widgets: [
      {
        dataSourceKey: "erp.margin",
        title: "Margem bruta",
        displayType: "STAT",
      },
      {
        dataSourceKey: "oracle.custom",
        title: "Inadimplência",
        displayType: "STAT",
      },
      {
        dataSourceKey: "oracle.custom",
        title: "Recebimentos do mês",
        displayType: "STAT",
      },
      {
        dataSourceKey: "erp.revenueTrend",
        title: "Fluxo de caixa (mês)",
        displayType: "CHART",
        chartKind: "LINE",
      },
    ],
  },
  {
    key: "mapa-brasil",
    category: "mapa",
    label: "Mapa de operações — Brasil",
    description: "Vendas por estado, em mapa coroplético.",
    widgets: [
      {
        dataSourceKey: "geo.salesByState",
        title: "Vendas por estado",
        displayType: "MAP",
      },
    ],
  },
  {
    key: "mapa-piaui",
    category: "mapa",
    label: "Mapa de operações — Piauí",
    description: "Vendas por município do Piauí.",
    widgets: [
      {
        dataSourceKey: "geo.salesByPiauiMunicipio",
        title: "Vendas por município — Piauí",
        displayType: "MAP",
      },
    ],
  },
  {
    key: "ia-alertas",
    category: "ia",
    label: "IA — alertas",
    description:
      "Placeholder para observações da IA. Widgets nascem vazios — configure as consultas ou métricas manuais depois.",
    widgets: [
      {
        dataSourceKey: "oracle.custom",
        title: "Alertas ativos",
        displayType: "LIST",
      },
    ],
  },
];

export function findTemplate(key: string): PanelTemplate | null {
  return PANEL_TEMPLATES.find((template) => template.key === key) ?? null;
}

export function templatesForCategory(
  category: PanelCategoryKey,
): PanelTemplate[] {
  return PANEL_TEMPLATES.filter((template) => template.category === category);
}
