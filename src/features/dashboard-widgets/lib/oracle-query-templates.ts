import type { OracleQueryConfig } from "./oracle-query-config";
import type { ReportTableConfig } from "./report-table";

// Modelos prontos de consulta — ponto de partida para não começar do zero.
//
// Arquivo puro (client + server). Todos usam a semântica de venda correta
// (`salesFilter: "valid"` = mesma regra do ranking) e um período em coluna
// indexada, então nascem já dentro do que o pré-voo aceita.
//
// Se o Winthor do cliente não tiver a tabela do modelo, a UI desabilita o
// modelo em vez de deixar o usuário tomar erro no "Testar consulta".

/**
 * Assunto do modelo — a lista passou de 30 itens e uma fileira única de chips
 * virou uma parede ilegível. O picker agrupa por isto, na ordem de
 * `ORACLE_TEMPLATE_CATEGORIES`.
 */
export type OracleTemplateCategory =
  | "Vendas"
  | "Relatórios Winthor"
  | "Estoque"
  | "WMS"
  | "Validade"
  | "Financeiro"
  | "Clientes"
  | "Metas";

/** Ordem de exibição — do mais usado no dia a dia para o mais específico. */
export const ORACLE_TEMPLATE_CATEGORIES: OracleTemplateCategory[] = [
  "Vendas",
  "Relatórios Winthor",
  "Estoque",
  "WMS",
  "Validade",
  "Financeiro",
  "Clientes",
  "Metas",
];

export interface OracleQueryTemplate {
  key: string;
  label: string;
  description: string;
  /** Obrigatório de propósito: modelo novo sem categoria não compila, então a
   * lista não volta a virar um amontoado solto. */
  category: OracleTemplateCategory;
  displayType: "STAT" | "CHART" | "LIST" | "TABLE";
  config: OracleQueryConfig;
  /** Colunas derivadas (% Part., Contrib., % Lucro…) aplicadas junto com a
   * consulta — sem isso o widget nasce só com as colunas RAW do Oracle. */
  report?: ReportTableConfig;
}

const receita = (label = "Receita") =>
  ({
    aggregation: "SUM",
    column: "VLTOTAL",
    label,
    unit: "currency",
  }) as const;

export const ORACLE_QUERY_TEMPLATES: OracleQueryTemplate[] = [
  {
    key: "faturamento-mes",
    category: "Vendas",
    label: "Faturamento do mês",
    description: "Só nota emitida, mês corrente.",
    displayType: "STAT",
    config: {
      version: 1,
      table: "PCPEDC",
      measures: [receita("Faturamento")],
      groupBy: { kind: "none" },
      dateFilter: { column: "DATA", preset: "currentMonth" },
      filters: [],
      salesFilter: "invoiced",
      orderBy: "measureDesc",
      limit: 20,
    },
  },
  {
    key: "vendas-por-mes",
    category: "Vendas",
    label: "Vendas por mês",
    description: "Evolução dos últimos 12 meses.",
    displayType: "CHART",
    config: {
      version: 1,
      table: "PCPEDC",
      measures: [receita()],
      groupBy: { kind: "date", column: "DATA", granularity: "month" },
      dateFilter: { column: "DATA", preset: "last12Months" },
      filters: [],
      salesFilter: "valid",
      orderBy: "groupAsc",
      limit: 12,
    },
  },
  {
    key: "vendas-por-filial",
    category: "Vendas",
    label: "Vendas por filial",
    description: "Últimos 30 dias, por filial.",
    displayType: "LIST",
    config: {
      version: 1,
      table: "PCPEDC",
      measures: [receita()],
      groupBy: { kind: "dimension", column: "CODFILIAL" },
      dateFilter: { column: "DATA", preset: "last30" },
      filters: [],
      salesFilter: "valid",
      orderBy: "measureDesc",
      limit: 10,
    },
  },
  {
    key: "ranking-vendedores",
    category: "Vendas",
    label: "Ranking de vendedores",
    description: "Mês corrente, maior receita primeiro.",
    displayType: "LIST",
    config: {
      version: 1,
      table: "PCPEDC",
      measures: [receita()],
      groupBy: { kind: "dimension", column: "CODUSUR" },
      dateFilter: { column: "DATA", preset: "currentMonth" },
      filters: [],
      salesFilter: "valid",
      orderBy: "measureDesc",
      limit: 15,
    },
  },
  {
    // Espelha o relatório Winthor "146 - Resumo de Vendas / Por Supervisor".
    // O motor Oracle limita a 6 medidas por consulta (oracleQueryConfigSchema)
    // e faz UMA tabela só — então "Ticket médio" vira coluna DERIVADA (Vl
    // venda ÷ Qt pedidos, via `report.countKey`) em vez de medida AVG própria,
    // liberando espaço pras 3 colunas novas (Qt.média itens, Peso, e o
    // denominador de %Desc). % Part./% Desc/Contrib./% Lucro/% MC/% Acum.
    // também são derivadas (ver `report-table.ts`) — nenhuma delas custa
    // measure slot.
    //
    // Ainda fora do alcance: "Qt RCAs" (COUNT_DISTINCT CODUSUR — o pré-voo do
    // servidor recusa COUNT_DISTINCT em tabela acima de 1M linhas, e PCPEDC
    // passa disso na maioria dos clientes reais; a consulta INTEIRA seria
    // recusada, não só essa coluna) e "Vl.meta/%Meta/Proj.vendas" (exigem a
    // tabela PCMETA — o motor só agrega UMA tabela por consulta, sem join).
    key: "resumo-por-supervisor",
    category: "Relatórios Winthor",
    label: "146 — Resumo de vendas (por supervisor)",
    description:
      "Venda, pedidos, ticket médio, custo, itens, peso e as razões (%Part/%Desc/%Lucro/%MC/%Acum) por supervisor — mês corrente. Espelha o relatório Winthor 146.",
    displayType: "TABLE",
    report: {
      valueKey: "M0",
      countKey: "M1",
      countLabel: "Ticket médio",
      costKey: "M2",
      tabelaKey: "M4",
      goalScope: "supervisor",
    },
    config: {
      version: 1,
      table: "PCPEDC",
      measures: [
        receita("Vl venda"),
        {
          aggregation: "COUNT",
          column: null,
          label: "Qt pedidos",
          unit: "number",
        },
        {
          aggregation: "SUM",
          column: "VLCUSTOREAL",
          label: "Custo",
          unit: "currency",
        },
        {
          aggregation: "AVG",
          column: "NUMITENS",
          label: "Qt.média itens",
          unit: "number",
        },
        {
          aggregation: "SUM",
          column: "VLTABELA",
          label: "Vl. tabela",
          unit: "currency",
        },
        {
          aggregation: "SUM",
          column: "TOTPESO",
          label: "Peso (Kg)",
          unit: "number",
        },
      ],
      groupBy: { kind: "dimension", column: "CODSUPERVISOR" },
      dateFilter: { column: "DATA", preset: "currentMonth" },
      filters: [],
      salesFilter: "valid",
      orderBy: "measureDesc",
      limit: 30,
    },
  },
  // --- KPIs agregados do mesmo relatório 146 (sem agrupar por supervisor) ---
  // Mesmo filtro EXATO de "resumo-por-supervisor" (tabela, período, salesFilter)
  // — combinados como tiras de STAT + gráfico, os números batem 1:1 com o total
  // do rodapé do relatório e com a soma das linhas da tabela detalhada.
  {
    key: "vl-venda-mes",
    category: "Relatórios Winthor",
    label: "146 — Vl. venda (mês)",
    description:
      "Total vendido no mês corrente — mesmo filtro do relatório 146.",
    displayType: "STAT",
    config: {
      version: 1,
      table: "PCPEDC",
      measures: [receita("Vl venda")],
      groupBy: { kind: "none" },
      dateFilter: { column: "DATA", preset: "currentMonth" },
      filters: [],
      salesFilter: "valid",
      orderBy: "measureDesc",
      limit: 20,
    },
  },
  {
    key: "qt-pedidos-mes",
    category: "Relatórios Winthor",
    label: "146 — Qt. pedidos (mês)",
    description: "Total de pedidos no mês corrente.",
    displayType: "STAT",
    config: {
      version: 1,
      table: "PCPEDC",
      measures: [
        {
          aggregation: "COUNT",
          column: null,
          label: "Qt pedidos",
          unit: "number",
        },
      ],
      groupBy: { kind: "none" },
      dateFilter: { column: "DATA", preset: "currentMonth" },
      filters: [],
      salesFilter: "valid",
      orderBy: "measureDesc",
      limit: 20,
    },
  },
  {
    key: "vl-medio-pedido-mes",
    category: "Relatórios Winthor",
    label: "146 — Vl. médio pedido (mês)",
    description: "Ticket médio dos pedidos no mês corrente.",
    displayType: "STAT",
    config: {
      version: 1,
      table: "PCPEDC",
      measures: [
        {
          aggregation: "AVG",
          column: "VLTOTAL",
          label: "Vl médio pedido",
          unit: "currency",
        },
      ],
      groupBy: { kind: "none" },
      dateFilter: { column: "DATA", preset: "currentMonth" },
      filters: [],
      salesFilter: "valid",
      orderBy: "measureDesc",
      limit: 20,
    },
  },
  {
    // Substitui um antigo "Qt. RCAs ativos" (COUNT_DISTINCT CODUSUR) — o
    // pré-voo do servidor recusa COUNT_DISTINCT em tabelas acima de 1M linhas
    // (PCPEDC costuma passar disso), então esse KPI nunca resolvia em
    // produção. SUM não tem essa restrição.
    key: "custo-mes",
    category: "Relatórios Winthor",
    label: "146 — Custo (mês)",
    description: "Custo total das vendas no mês corrente.",
    displayType: "STAT",
    config: {
      version: 1,
      table: "PCPEDC",
      measures: [
        {
          aggregation: "SUM",
          column: "VLCUSTOREAL",
          label: "Custo",
          unit: "currency",
        },
      ],
      groupBy: { kind: "none" },
      dateFilter: { column: "DATA", preset: "currentMonth" },
      filters: [],
      salesFilter: "valid",
      orderBy: "measureDesc",
      limit: 20,
    },
  },
  {
    key: "vendas-por-supervisor-chart",
    category: "Relatórios Winthor",
    label: "146 — Vendas por supervisor (gráfico)",
    description: "Comparativo visual de venda por supervisor — mês corrente.",
    displayType: "CHART",
    config: {
      version: 1,
      table: "PCPEDC",
      measures: [receita("Vl venda")],
      groupBy: { kind: "dimension", column: "CODSUPERVISOR" },
      dateFilter: { column: "DATA", preset: "currentMonth" },
      filters: [],
      salesFilter: "valid",
      orderBy: "measureDesc",
      limit: 15,
    },
  },
  {
    // Tabela "Meta" (PCMETA), confirmada na conexão real da Gotham (6.914
    // linhas — pequena, bem abaixo do limiar de tabela grande). Meta é
    // lançada por RCA (CODUSUR); não existe CODSUPERVISOR em PCMETA, então
    // "Vl.meta por SUPERVISOR" (como no relatório 146) exigiria um segundo
    // salto PCMETA → PCUSUARI → agrupar por supervisor, que o motor de
    // consulta de UMA tabela não faz. Isto aqui é o nível que dá pra buscar
    // direto: meta por RCA, pareável com o relatório 114.
    key: "vl-meta-por-rca",
    category: "Metas",
    label: "Vl. meta (por RCA)",
    description:
      "Valor de venda previsto (meta) por RCA — mês corrente. Tabela PCMETA.",
    displayType: "TABLE",
    config: {
      version: 1,
      table: "PCMETA",
      measures: [
        {
          aggregation: "SUM",
          column: "VLVENDAPREV",
          label: "Vl. meta",
          unit: "currency",
        },
      ],
      groupBy: { kind: "dimension", column: "CODUSUR" },
      dateFilter: { column: "DATA", preset: "currentMonth" },
      filters: [],
      salesFilter: null,
      orderBy: "measureDesc",
      limit: 30,
    },
  },
  {
    // Espelha "114 - Vendas por Superv./Rca/Cliente / Por RCA". Ranking de RCAs
    // por venda, com pedidos, ticket e custo — base para margem/contribuição
    // (venda − custo) que o front pode derivar.
    key: "ranking-rca-detalhado",
    category: "Relatórios Winthor",
    label: "114 — Vendas por RCA (detalhado)",
    description:
      "Venda, pedidos, ticket e custo por RCA — mês corrente, maior venda primeiro. Espelha o relatório Winthor 114.",
    displayType: "TABLE",
    report: { valueKey: "M0", costKey: "M3", goalScope: "usuario" },
    config: {
      version: 1,
      table: "PCPEDC",
      measures: [
        receita("Vl venda"),
        {
          aggregation: "COUNT",
          column: null,
          label: "Qt ped.",
          unit: "number",
        },
        {
          aggregation: "AVG",
          column: "VLTOTAL",
          label: "Vl médio ped.",
          unit: "currency",
        },
        {
          aggregation: "SUM",
          column: "VLCUSTOREAL",
          label: "Custo",
          unit: "currency",
        },
      ],
      groupBy: { kind: "dimension", column: "CODUSUR" },
      dateFilter: { column: "DATA", preset: "currentMonth" },
      filters: [],
      salesFilter: "valid",
      orderBy: "measureDesc",
      limit: 30,
    },
  },
  {
    key: "top-clientes",
    category: "Vendas",
    label: "Top clientes",
    description: "Quem mais comprou nos últimos 90 dias.",
    displayType: "LIST",
    config: {
      version: 1,
      table: "PCPEDC",
      measures: [receita()],
      groupBy: { kind: "dimension", column: "CODCLI" },
      dateFilter: { column: "DATA", preset: "last90" },
      filters: [],
      salesFilter: "valid",
      orderBy: "measureDesc",
      limit: 10,
    },
  },
  {
    key: "ticket-medio",
    category: "Vendas",
    label: "Ticket médio",
    description: "Valor médio por pedido, últimos 30 dias.",
    displayType: "STAT",
    config: {
      version: 1,
      table: "PCPEDC",
      measures: [
        {
          aggregation: "AVG",
          column: "VLTOTAL",
          label: "Ticket médio",
          unit: "currency",
        },
      ],
      groupBy: { kind: "none" },
      dateFilter: { column: "DATA", preset: "last30" },
      filters: [],
      salesFilter: "valid",
      orderBy: "measureDesc",
      limit: 20,
    },
  },
  {
    key: "pedidos-por-dia",
    category: "Vendas",
    label: "Pedidos por dia",
    description: "Volume diário dos últimos 30 dias.",
    displayType: "CHART",
    config: {
      version: 1,
      table: "PCPEDC",
      measures: [
        {
          aggregation: "COUNT",
          column: null,
          label: "Pedidos",
          unit: "number",
        },
      ],
      groupBy: { kind: "date", column: "DATA", granularity: "day" },
      dateFilter: { column: "DATA", preset: "last30" },
      filters: [],
      salesFilter: "valid",
      orderBy: "groupAsc",
      limit: 31,
    },
  },
  {
    key: "desempenho-filial",
    category: "Vendas",
    label: "Desempenho por filial",
    description: "Receita, pedidos e ticket médio lado a lado.",
    displayType: "TABLE",
    config: {
      version: 1,
      table: "PCPEDC",
      measures: [
        receita(),
        {
          aggregation: "COUNT",
          column: null,
          label: "Pedidos",
          unit: "number",
        },
        {
          aggregation: "AVG",
          column: "VLTOTAL",
          label: "Ticket médio",
          unit: "currency",
        },
      ],
      groupBy: { kind: "dimension", column: "CODFILIAL" },
      dateFilter: { column: "DATA", preset: "currentMonth" },
      filters: [],
      salesFilter: "valid",
      orderBy: "measureDesc",
      limit: 20,
    },
  },
  {
    key: "produtos-mais-vendidos",
    category: "Vendas",
    label: "Produtos mais vendidos",
    description: "Quantidade vendida nos últimos 30 dias.",
    displayType: "LIST",
    config: {
      version: 1,
      table: "PCPEDI",
      measures: [
        {
          aggregation: "SUM",
          column: "QT",
          label: "Quantidade",
          unit: "number",
        },
      ],
      groupBy: { kind: "dimension", column: "CODPROD" },
      dateFilter: { column: "DATA", preset: "last30" },
      filters: [],
      salesFilter: "valid",
      orderBy: "measureDesc",
      limit: 10,
    },
  },
  // --- Estoque ---
  //
  // Importante: a credencial NÃO alcança PCEST (saldo atual de estoque), só
  // PCMOV (movimentação). Então estes modelos falam de fluxo — o que entrou e
  // saiu no período — e não de "quanto tem em estoque hoje". Filtram por
  // CODOPER, que no Winthor separa entrada (E*) de saída (S*) e, neste
  // cliente, é primeira coluna de índice — logo o filtro é rápido.
  {
    key: "saidas-estoque",
    category: "Estoque",
    label: "Saídas de estoque",
    description: "Quantidade que saiu nos últimos 30 dias.",
    displayType: "STAT",
    config: {
      version: 1,
      table: "PCMOV",
      measures: [
        {
          aggregation: "SUM",
          column: "QT",
          label: "Quantidade",
          unit: "number",
        },
      ],
      groupBy: { kind: "none" },
      dateFilter: { column: "DTMOV", preset: "last30" },
      filters: [{ column: "CODOPER", operator: "eq", values: ["S"] }],
      salesFilter: null,
      orderBy: "measureDesc",
      limit: 20,
    },
  },
  {
    key: "entradas-estoque",
    category: "Estoque",
    label: "Entradas de estoque",
    description: "Quantidade que entrou nos últimos 30 dias.",
    displayType: "STAT",
    config: {
      version: 1,
      table: "PCMOV",
      measures: [
        {
          aggregation: "SUM",
          column: "QT",
          label: "Quantidade",
          unit: "number",
        },
      ],
      groupBy: { kind: "none" },
      dateFilter: { column: "DTMOV", preset: "last30" },
      filters: [{ column: "CODOPER", operator: "eq", values: ["E"] }],
      salesFilter: null,
      orderBy: "measureDesc",
      limit: 20,
    },
  },
  {
    key: "produtos-mais-saida",
    category: "Estoque",
    label: "Produtos com mais saída",
    description: "Maior giro de estoque nos últimos 30 dias.",
    displayType: "LIST",
    config: {
      version: 1,
      table: "PCMOV",
      measures: [
        {
          aggregation: "SUM",
          column: "QT",
          label: "Quantidade",
          unit: "number",
        },
      ],
      groupBy: { kind: "dimension", column: "CODPROD" },
      dateFilter: { column: "DTMOV", preset: "last30" },
      filters: [{ column: "CODOPER", operator: "eq", values: ["S"] }],
      salesFilter: null,
      orderBy: "measureDesc",
      limit: 10,
    },
  },
  {
    key: "movimentacao-diaria",
    category: "Estoque",
    label: "Saída de estoque por dia",
    description: "Fluxo diário dos últimos 30 dias.",
    displayType: "CHART",
    config: {
      version: 1,
      table: "PCMOV",
      measures: [
        {
          aggregation: "SUM",
          column: "QT",
          label: "Quantidade",
          unit: "number",
        },
      ],
      groupBy: { kind: "date", column: "DTMOV", granularity: "day" },
      dateFilter: { column: "DTMOV", preset: "last30" },
      filters: [{ column: "CODOPER", operator: "eq", values: ["S"] }],
      salesFilter: null,
      orderBy: "groupAsc",
      limit: 31,
    },
  },
  {
    key: "estoque-por-filial",
    category: "Estoque",
    label: "Saídas por filial",
    description: "Quantidade e nº de movimentos por filial.",
    displayType: "TABLE",
    config: {
      version: 1,
      table: "PCMOV",
      measures: [
        {
          aggregation: "SUM",
          column: "QT",
          label: "Quantidade",
          unit: "number",
        },
        {
          aggregation: "COUNT",
          column: null,
          label: "Movimentos",
          unit: "number",
        },
      ],
      groupBy: { kind: "dimension", column: "CODFILIAL" },
      dateFilter: { column: "DTMOV", preset: "last30" },
      filters: [{ column: "CODOPER", operator: "eq", values: ["S"] }],
      salesFilter: null,
      orderBy: "measureDesc",
      limit: 20,
    },
  },
  {
    key: "entradas-por-fornecedor",
    category: "Estoque",
    label: "Entradas por fornecedor",
    description: "Quem mais abasteceu nos últimos 90 dias.",
    displayType: "LIST",
    config: {
      version: 1,
      table: "PCMOV",
      measures: [
        {
          aggregation: "SUM",
          column: "QT",
          label: "Quantidade",
          unit: "number",
        },
      ],
      groupBy: { kind: "dimension", column: "CODFORNEC" },
      dateFilter: { column: "DTMOV", preset: "last90" },
      filters: [{ column: "CODOPER", operator: "eq", values: ["E"] }],
      salesFilter: null,
      orderBy: "measureDesc",
      limit: 10,
    },
  },
  // --- Vencimento ---
  //
  // A validade vem de PCPRODUT.DTVENC (5.960 dos 23.868 produtos preenchidos e
  // ativamente mantido — medido). PCLOTE não está liberado para esta
  // credencial e PCMOV.DATAVALIDADE é 100% nulo neste cliente, então NÃO há
  // como saber a validade por lote em estoque: é validade por CADASTRO de
  // produto. Clicar no card lista quais são, com a data.
  {
    key: "vencendo-30d",
    category: "Validade",
    label: "Vencendo em 30 dias",
    description: "Produtos com validade nos próximos 30 dias.",
    displayType: "STAT",
    config: {
      version: 1,
      table: "PCPRODUT",
      measures: [
        {
          aggregation: "COUNT",
          column: null,
          label: "Produtos",
          unit: "number",
        },
      ],
      groupBy: { kind: "none" },
      dateFilter: { column: "DTVENC", preset: "next30" },
      filters: [],
      salesFilter: null,
      orderBy: "measureDesc",
      limit: 20,
    },
  },
  {
    key: "vencidos",
    category: "Validade",
    label: "Produtos vencidos",
    description: "Validade já expirada no cadastro.",
    displayType: "STAT",
    config: {
      version: 1,
      table: "PCPRODUT",
      measures: [
        {
          aggregation: "COUNT",
          column: null,
          label: "Produtos",
          unit: "number",
        },
      ],
      groupBy: { kind: "none" },
      dateFilter: { column: "DTVENC", preset: "overdue" },
      filters: [],
      salesFilter: null,
      orderBy: "measureDesc",
      limit: 20,
    },
  },
  {
    key: "vencimento-por-departamento",
    category: "Validade",
    label: "Vencimento por departamento",
    description: "Onde se concentra o que vence em 90 dias.",
    displayType: "LIST",
    config: {
      version: 1,
      table: "PCPRODUT",
      measures: [
        {
          aggregation: "COUNT",
          column: null,
          label: "Produtos",
          unit: "number",
        },
      ],
      groupBy: { kind: "dimension", column: "CODEPTO" },
      dateFilter: { column: "DTVENC", preset: "next90" },
      filters: [],
      salesFilter: null,
      orderBy: "measureDesc",
      limit: 15,
    },
  },
  // --- Inadimplência ---
  //
  // PCPREST é a tabela de PRESTAÇÕES do Winthor — cada parcela de venda. É o
  // padrão para "contas a receber": uma parcela em aberto e vencida ontem é o
  // que define inadimplência.
  //
  // Filtro combinado: `DTVENC overdue` (data no passado) + `DTPAG isNull` (não
  // pago). DTVENC costuma ser primeira coluna de índice em PCPREST — sustenta
  // o pré-voo mesmo em bases grandes. DTPAG raramente é indexada, então pode
  // sair "warning" (o segundo filtro não reduz varredura), mas DTVENC já
  // recorta o suficiente.
  //
  // `salesFilter` fica null: essa opção só se aplica às tabelas de venda
  // (PCPEDC). Coluna de valor é VALOR (não começa com "VL", então o
  // dicionário classifica como dimensão, mas SUM em NUMBER passa no pré-voo —
  // isso já é o comportamento estabelecido de outros modelos).
  {
    key: "inadimplencia-total",
    category: "Financeiro",
    label: "Total em atraso",
    description: "Soma das parcelas vencidas e não pagas.",
    displayType: "STAT",
    config: {
      version: 1,
      table: "PCPREST",
      measures: [
        {
          aggregation: "SUM",
          column: "VALOR",
          label: "Em atraso",
          unit: "currency",
        },
      ],
      groupBy: { kind: "none" },
      dateFilter: { column: "DTVENC", preset: "overdue" },
      filters: [{ column: "DTPAG", operator: "isNull", values: [] }],
      salesFilter: null,
      orderBy: "measureDesc",
      limit: 20,
    },
  },
  {
    key: "inadimplencia-por-filial",
    category: "Financeiro",
    label: "Inadimplência por filial",
    description: "Onde se concentra o atraso.",
    displayType: "LIST",
    config: {
      version: 1,
      table: "PCPREST",
      measures: [
        {
          aggregation: "SUM",
          column: "VALOR",
          label: "Em atraso",
          unit: "currency",
        },
      ],
      groupBy: { kind: "dimension", column: "CODFILIAL" },
      dateFilter: { column: "DTVENC", preset: "overdue" },
      filters: [{ column: "DTPAG", operator: "isNull", values: [] }],
      salesFilter: null,
      orderBy: "measureDesc",
      limit: 10,
    },
  },
  {
    key: "top-clientes-inadimplentes",
    category: "Financeiro",
    label: "Top clientes inadimplentes",
    description: "Quem mais deve em parcelas vencidas.",
    displayType: "LIST",
    config: {
      version: 1,
      table: "PCPREST",
      measures: [
        {
          aggregation: "SUM",
          column: "VALOR",
          label: "Em atraso",
          unit: "currency",
        },
      ],
      groupBy: { kind: "dimension", column: "CODCLI" },
      dateFilter: { column: "DTVENC", preset: "overdue" },
      filters: [{ column: "DTPAG", operator: "isNull", values: [] }],
      salesFilter: null,
      orderBy: "measureDesc",
      limit: 10,
    },
  },
  {
    key: "vencendo-proximos-30d",
    category: "Financeiro",
    label: "Vencendo em 30 dias",
    description: "Parcelas ainda em dia mas próximas do vencimento.",
    displayType: "STAT",
    config: {
      version: 1,
      table: "PCPREST",
      measures: [
        {
          aggregation: "SUM",
          column: "VALOR",
          label: "A vencer",
          unit: "currency",
        },
      ],
      groupBy: { kind: "none" },
      dateFilter: { column: "DTVENC", preset: "next30" },
      filters: [{ column: "DTPAG", operator: "isNull", values: [] }],
      salesFilter: null,
      orderBy: "measureDesc",
      limit: 20,
    },
  },
  // --- Inadimplência (sem PCPREST) ---
  //
  // Os modelos acima dependem de PCPREST (prestações), que só existe em
  // conexões que expõem o módulo financeiro do Winthor. Confirmado ao vivo
  // (schema da Gotham) que várias conexões trazem só um recorte comercial —
  // PCCLIENT, PCPEDC/PCPEDI, PCMOV, PCPRODUT etc., sem PCPREST/PCTITULO. A UI
  // já desabilita modelo com tabela ausente (comentário no topo do arquivo),
  // então isso não quebra nada — só fica sem opção de inadimplência nessas
  // conexões. Os 3 modelos abaixo cobrem esse caso com o que PCCLIENT tem:
  //
  //   • CLIENTPROTESTO = 'S' — cliente com título protestado. É o sinal mais
  //     limpo de inadimplência real (~1% da base da Gotham). Verificado ao
  //     vivo: NUMDIASPROTESTO vem 0 pra toda a amostra (campo não mantido
  //     nesta base), por isso o ranking usa LIMCRED, não dias de protesto.
  //   • BLOQUEIODEFINITIVO = 'S' — bloqueio específico e raro (~0,3% da
  //     base). NÃO usar o BLOQUEIO geral: na Gotham ele vem 'S' pra ~90% dos
  //     clientes (cobre inatividade/fiscal/etc., não é sinal de dívida).
  {
    key: "clientes-protesto-total",
    category: "Financeiro",
    label: "Clientes com título protestado",
    description:
      "Quantos clientes têm protesto ativo — inadimplência real, sem depender de PCPREST.",
    displayType: "STAT",
    config: {
      version: 1,
      table: "PCCLIENT",
      measures: [
        {
          aggregation: "COUNT",
          column: null,
          label: "Clientes protestados",
          unit: "number",
        },
      ],
      groupBy: { kind: "none" },
      dateFilter: null,
      filters: [{ column: "CLIENTPROTESTO", operator: "eq", values: ["S"] }],
      salesFilter: null,
      orderBy: "measureDesc",
      limit: 20,
    },
  },
  {
    key: "clientes-protesto-lista",
    category: "Financeiro",
    label: "Lista de clientes protestados",
    description:
      "Um por linha, com o limite de crédito atual — clique numa linha pra ver telefone/CNPJ/cidade.",
    displayType: "LIST",
    config: {
      version: 1,
      table: "PCCLIENT",
      measures: [
        {
          aggregation: "MAX",
          column: "LIMCRED",
          label: "Limite de crédito",
          unit: "currency",
        },
      ],
      groupBy: { kind: "dimension", column: "CODCLI" },
      dateFilter: null,
      filters: [{ column: "CLIENTPROTESTO", operator: "eq", values: ["S"] }],
      salesFilter: null,
      // "groupAsc" (por código) em vez de medida: a maioria dos protestados
      // tem LIMCRED zerado (verificado ao vivo), então ordenar pela medida só
      // empataria — ordem por código é honesta e determinística.
      orderBy: "groupAsc",
      limit: 50,
    },
  },
  {
    key: "clientes-bloqueio-definitivo",
    category: "Financeiro",
    label: "Clientes com bloqueio definitivo",
    description:
      "BLOQUEIODEFINITIVO — bloqueio específico, não o BLOQUEIO geral (que também pega inatividade/fiscal).",
    displayType: "STAT",
    config: {
      version: 1,
      table: "PCCLIENT",
      measures: [
        {
          aggregation: "COUNT",
          column: null,
          label: "Clientes bloqueados",
          unit: "number",
        },
      ],
      groupBy: { kind: "none" },
      dateFilter: null,
      filters: [
        { column: "BLOQUEIODEFINITIVO", operator: "eq", values: ["S"] },
      ],
      salesFilter: null,
      orderBy: "measureDesc",
      limit: 20,
    },
  },
  // --- Clientes positivados desde 2025 ---
  //
  // DTULTCOMP (PCCLIENT) é a data da ÚLTIMA compra do cliente — índice líder,
  // então o filtro sustenta o pré-voo mesmo com a base toda. Não existe data
  // futura de negócio (ninguém compra "amanhã"), então "de 2025 até hoje" não
  // precisa de limite superior dinâmico: um "custom" com `to` bem à frente
  // (2030) já cobre qualquer hoje real sem precisar reeditar o modelo depois.
  {
    key: "clientes-positivados-2025",
    category: "Clientes",
    label: "Clientes positivados desde 2025",
    description:
      "Quantos clientes ainda compraram alguma vez a partir de 2025 (última compra).",
    displayType: "STAT",
    config: {
      version: 1,
      table: "PCCLIENT",
      measures: [
        {
          aggregation: "COUNT",
          column: null,
          label: "Clientes positivados",
          unit: "number",
        },
      ],
      groupBy: { kind: "none" },
      dateFilter: {
        column: "DTULTCOMP",
        preset: "custom",
        from: "2025-01-01",
        to: "2030-12-31",
      },
      filters: [],
      salesFilter: null,
      orderBy: "measureDesc",
      limit: 20,
    },
  },
  {
    // Sai de PCCLIENT e vai pra PCPEDC: venda/itens/custo/peso são do PEDIDO,
    // não do cadastro do cliente — e o motor agrega UMA tabela por consulta.
    // Agrupar os pedidos de 2025+ por CODCLI dá a mesma população ("quem
    // comprou desde 2025") já com os totais do período, e "Última compra" vira
    // MAX(DATA) em vez de depender do DTULTCOMP do cadastro.
    //
    // 6 medidas = teto do schema. Trocar alguma coluna aqui é o caminho pra
    // quem quiser outra (ex.: Vl. tabela no lugar do peso).
    key: "clientes-positivados-2025-lista",
    category: "Clientes",
    label: "Lista de clientes positivados desde 2025",
    description:
      "Um cliente por linha, com última compra, venda, pedidos, itens, custo e peso acumulados de 2025 até hoje.",
    displayType: "TABLE",
    config: {
      version: 1,
      table: "PCPEDC",
      measures: [
        {
          aggregation: "MAX",
          column: "DATA",
          label: "Última compra",
          unit: "number",
        },
        receita("Vl. venda"),
        {
          aggregation: "COUNT",
          column: null,
          label: "Qt. pedidos",
          unit: "number",
        },
        {
          aggregation: "SUM",
          column: "NUMITENS",
          label: "Qt. itens",
          unit: "number",
        },
        {
          aggregation: "SUM",
          column: "VLCUSTOREAL",
          label: "Custo",
          unit: "currency",
        },
        {
          aggregation: "SUM",
          column: "TOTPESO",
          label: "Peso (Kg)",
          unit: "number",
        },
      ],
      groupBy: { kind: "dimension", column: "CODCLI" },
      dateFilter: {
        column: "DATA",
        preset: "custom",
        from: "2025-01-01",
        to: "2030-12-31",
      },
      filters: [],
      salesFilter: "valid",
      // Compra mais recente primeiro (M0 = MAX(DATA)) — o corte de `limit`
      // fica nos clientes ativos, não numa fatia alfabética.
      orderBy: "measureDesc",
      limit: 200,
    },
  },
  // --- Saldo de estoque (PCEST) ---
  //
  // PCEST é o saldo POR FILIAL/PRODUTO — é a tabela que faltava até ser
  // liberada (antes só dava para ver movimentação, via PCMOV). Com ~90 mil
  // linhas ela fica abaixo do limite do pré-voo, então dispensa filtro de
  // período: estoque é foto do agora, não série histórica.
  //
  // `salesFilter` fica null — a semântica de venda só existe em PCPEDC.
  {
    key: "estoque-atual-total",
    category: "Estoque",
    label: "Estoque atual (unidades)",
    description: "Saldo geral em unidades, somando todas as filiais.",
    displayType: "STAT",
    config: {
      version: 1,
      table: "PCEST",
      measures: [
        {
          aggregation: "SUM",
          column: "QTESTGER",
          label: "Estoque",
          unit: "number",
        },
      ],
      groupBy: { kind: "none" },
      dateFilter: null,
      filters: [],
      salesFilter: null,
      orderBy: "measureDesc",
      limit: 20,
    },
  },
  {
    key: "estoque-saldo-por-filial",
    category: "Estoque",
    label: "Saldo de estoque por filial",
    description: "Onde o estoque está parado, em unidades.",
    displayType: "LIST",
    config: {
      version: 1,
      table: "PCEST",
      measures: [
        {
          aggregation: "SUM",
          column: "QTESTGER",
          label: "Estoque",
          unit: "number",
        },
      ],
      groupBy: { kind: "dimension", column: "CODFILIAL" },
      dateFilter: null,
      filters: [],
      salesFilter: null,
      orderBy: "measureDesc",
      limit: 20,
    },
  },
  {
    key: "estoque-maior-saldo-produto",
    category: "Estoque",
    label: "Produtos com maior estoque",
    description: "Maior saldo primeiro — candidatos a excesso de cobertura.",
    displayType: "LIST",
    config: {
      version: 1,
      table: "PCEST",
      measures: [
        {
          aggregation: "SUM",
          column: "QTESTGER",
          label: "Estoque",
          unit: "number",
        },
      ],
      groupBy: { kind: "dimension", column: "CODPROD" },
      dateFilter: null,
      filters: [{ column: "QTESTGER", operator: "gt", values: [0] }],
      salesFilter: null,
      orderBy: "measureDesc",
      limit: 30,
    },
  },
  {
    // Espelho do "maior estoque": mesma consulta, ordem invertida. O filtro
    // `QTESTGER > 0` é o que dá sentido à lista — sem ele o topo viraria uma
    // parede de zeros (produto já esgotado ou nunca comprado), e o que se
    // quer aqui é o que está ACABANDO, não o que já acabou.
    //
    // TABLE e não LIST: aqui o saldo é um número pequeno ("1") e sozinho ele
    // não diz nada, porque o Winthor conta na UNIDADE DE VENDA do item — "1"
    // pode ser 1 dúzia, 1 caixa ou 1 display. A tabela traz a coluna Unidade
    // junto (vem do cadastro do produto); a lista só exibe o número.
    key: "estoque-menor-saldo-produto",
    category: "Estoque",
    label: "Produtos com menor estoque",
    description:
      "Menor saldo primeiro, ignorando os zerados — o que está prestes a faltar. Mostra a unidade de venda de cada item.",
    displayType: "TABLE",
    config: {
      version: 1,
      table: "PCEST",
      measures: [
        {
          aggregation: "SUM",
          column: "QTESTGER",
          label: "Estoque",
          unit: "number",
        },
      ],
      groupBy: { kind: "dimension", column: "CODPROD" },
      dateFilter: null,
      filters: [{ column: "QTESTGER", operator: "gt", values: [0] }],
      salesFilter: null,
      orderBy: "measureAsc",
      limit: 30,
    },
  },
  // --- Rupturas e divergências ---
  //
  // Cuidado com "produto zerado" nesta base: a PCEST tem uma linha por
  // FILIAL/produto e o catálogo inteiro está cadastrado em todas as filiais,
  // mesmo nas que não trabalham o item. Medido aqui: das 23.872 referências,
  // 19.397 estão zeradas na filial 1 e 21.948 na filial 2 — ou seja, "zerado"
  // quase sempre significa "esta filial não vende isso", não ruptura.
  //
  // Por isso os dois modelos abaixo cruzam saldo zero COM venda no mês
  // (`QTVENDMES > 0`): o item vendeu e acabou. Esse é o corte que separa
  // ruptura de item fora do mix.
  {
    key: "estoque-ruptura-total",
    category: "Estoque",
    label: "Produtos em ruptura",
    description:
      "Quantos produtos venderam no mês e estão sem saldo — cada produto conta uma vez.",
    displayType: "STAT",
    config: {
      version: 1,
      table: "PCEST",
      measures: [
        {
          aggregation: "COUNT_DISTINCT",
          column: "CODPROD",
          label: "Em ruptura",
          unit: "number",
        },
      ],
      groupBy: { kind: "none" },
      dateFilter: null,
      filters: [
        { column: "QTESTGER", operator: "lte", values: [0] },
        { column: "QTVENDMES", operator: "gt", values: [0] },
      ],
      salesFilter: null,
      orderBy: "measureDesc",
      limit: 20,
    },
  },
  {
    // Ordena pela última saída (M0) decrescente: o que saiu mais recentemente
    // e está sem saldo aparece primeiro — é a fila de reposição. TABLE porque
    // LIST só exibe um número por linha.
    key: "estoque-ruptura-detalhada",
    category: "Estoque",
    label: "Ruptura por produto (fila de reposição)",
    description:
      "Produtos sem saldo que venderam no mês, com a última saída e o histórico — o que repor primeiro.",
    displayType: "TABLE",
    config: {
      version: 1,
      table: "PCEST",
      measures: [
        {
          aggregation: "MAX",
          column: "DTULTSAIDA",
          label: "Última saída",
          unit: "number",
        },
        {
          aggregation: "SUM",
          column: "QTVENDMES",
          label: "Venda mês",
          unit: "number",
        },
        {
          aggregation: "SUM",
          column: "QTVENDMES1",
          label: "Mês -1",
          unit: "number",
        },
        {
          aggregation: "SUM",
          column: "QTVENDMES2",
          label: "Mês -2",
          unit: "number",
        },
      ],
      groupBy: { kind: "dimension", column: "CODPROD" },
      dateFilter: null,
      filters: [
        { column: "QTESTGER", operator: "lte", values: [0] },
        { column: "QTVENDMES", operator: "gt", values: [0] },
      ],
      salesFilter: null,
      orderBy: "measureDesc",
      limit: 100,
    },
  },
  {
    // Saldo negativo não é ruptura, é DIVERGÊNCIA: saiu mais do que o sistema
    // sabia que existia (baixa sem entrada, inventário errado). Widget de
    // monitoramento — o esperado é vir vazio; linha aqui é erro para corrigir.
    key: "estoque-negativo",
    category: "Estoque",
    label: "Estoque negativo (divergência)",
    description:
      "Saldo abaixo de zero — indica baixa sem entrada ou inventário errado. O esperado é ficar vazio.",
    displayType: "LIST",
    config: {
      version: 1,
      table: "PCEST",
      measures: [
        {
          aggregation: "SUM",
          column: "QTESTGER",
          label: "Saldo",
          unit: "number",
        },
      ],
      groupBy: { kind: "dimension", column: "CODPROD" },
      dateFilter: null,
      filters: [{ column: "QTESTGER", operator: "lt", values: [0] }],
      salesFilter: null,
      orderBy: "measureAsc",
      limit: 50,
    },
  },
  {
    // A "posição de estoque" que o pessoal de compras costuma pedir: o saldo
    // contábil (QTESTGER) e o que já está comprometido — reservado, pendente,
    // em trânsito e bloqueado. Só faz sentido como TABLE.
    key: "estoque-posicao-produto",
    category: "Estoque",
    label: "Posição de estoque por produto",
    description:
      "Saldo, reservado, pendente, em trânsito e bloqueado — o disponível real por produto.",
    displayType: "TABLE",
    config: {
      version: 1,
      table: "PCEST",
      measures: [
        {
          aggregation: "SUM",
          column: "QTESTGER",
          label: "Estoque",
          unit: "number",
        },
        {
          aggregation: "SUM",
          column: "QTRESERV",
          label: "Reservado",
          unit: "number",
        },
        {
          aggregation: "SUM",
          column: "QTPENDENTE",
          label: "Pendente",
          unit: "number",
        },
        {
          aggregation: "SUM",
          column: "QTTRANSITO",
          label: "Em trânsito",
          unit: "number",
        },
        {
          aggregation: "SUM",
          column: "QTBLOQUEADA",
          label: "Bloqueado",
          unit: "number",
        },
        {
          aggregation: "MAX",
          column: "DTULTSAIDA",
          label: "Última saída",
          unit: "number",
        },
      ],
      groupBy: { kind: "dimension", column: "CODPROD" },
      dateFilter: null,
      filters: [{ column: "QTESTGER", operator: "gt", values: [0] }],
      salesFilter: null,
      orderBy: "measureDesc",
      limit: 100,
    },
  },
  {
    // Giro mês a mês SEM varrer PCMOV (17 milhões de linhas): o próprio
    // Winthor já mantém os acumulados em PCEST. QTVENDMES é o mês corrente e
    // MES1/MES2/MES3 são os três anteriores — é o mesmo recorte que o SELECT
    // do consultor monta com um subselect por mês.
    key: "estoque-giro-mensal",
    category: "Estoque",
    label: "Giro por produto (mês a mês)",
    description:
      "Venda do mês corrente e dos 3 anteriores, com o saldo atual ao lado — cobertura por produto.",
    displayType: "TABLE",
    config: {
      version: 1,
      table: "PCEST",
      measures: [
        {
          aggregation: "SUM",
          column: "QTESTGER",
          label: "Estoque",
          unit: "number",
        },
        {
          aggregation: "SUM",
          column: "QTVENDMES",
          label: "Venda mês",
          unit: "number",
        },
        {
          aggregation: "SUM",
          column: "QTVENDMES1",
          label: "Mês -1",
          unit: "number",
        },
        {
          aggregation: "SUM",
          column: "QTVENDMES2",
          label: "Mês -2",
          unit: "number",
        },
        {
          aggregation: "SUM",
          column: "QTVENDMES3",
          label: "Mês -3",
          unit: "number",
        },
        {
          aggregation: "SUM",
          column: "QTGIRODIA",
          label: "Giro/dia",
          unit: "number",
        },
      ],
      groupBy: { kind: "dimension", column: "CODPROD" },
      dateFilter: null,
      filters: [{ column: "QTESTGER", operator: "gt", values: [0] }],
      salesFilter: null,
      orderBy: "measureDesc",
      limit: 100,
    },
  },
  {
    // Estoque parado: tem saldo e a última saída é anterior ao corte. Usa
    // `before90` (e não `overdue`, que é "antes de hoje" e deixaria passar
    // item vendido hoje de manhã). Trocar para 30/180 dias no montador muda
    // o rigor do corte.
    key: "estoque-sem-saida",
    category: "Estoque",
    label: "Estoque parado (90+ dias)",
    description:
      "Produtos com saldo cuja última saída foi há mais de 90 dias — capital parado.",
    displayType: "LIST",
    config: {
      version: 1,
      table: "PCEST",
      measures: [
        {
          aggregation: "SUM",
          column: "QTESTGER",
          label: "Estoque",
          unit: "number",
        },
      ],
      groupBy: { kind: "dimension", column: "CODPROD" },
      dateFilter: { column: "DTULTSAIDA", preset: "before90" },
      filters: [{ column: "QTESTGER", operator: "gt", values: [0] }],
      salesFilter: null,
      orderBy: "measureDesc",
      limit: 50,
    },
  },
  // --- WMS (SWMS.TBCMS0027) ---
  //
  // Tabela do WMS, em schema PRÓPRIO (SWMS) — só acessível depois que o motor
  // passou a qualificar cada tabela pelo dono. É a visão do ARMAZÉM: o que
  // está fisicamente disponível para separação, o que está retido e onde está
  // endereçado. Complementa a PCEST, que é a visão contábil do ERP.
  //
  // ATENÇÃO — colunas propositalmente de fora: LASTROPALETE, ALTURAPALETE,
  // PESOBRUTOCX e CUBAGEMCX estão corrompidas nesta base (medido: máximos na
  // casa de 10^12 a 10^17 e cubagem negativa, nas duas filiais que operam).
  // Qualquer média/soma delas sairia bonita e errada. Só voltam a ser
  // utilizáveis depois que o pessoal do WMS corrigir a origem.
  // QTDESTPENDENTRADA também ficou de fora: é zero em toda a base.
  {
    key: "wms-disponivel-total",
    category: "WMS",
    label: "Disponível no WMS",
    description:
      "Saldo fisicamente disponível para separação, somando as filiais.",
    displayType: "STAT",
    config: {
      version: 1,
      table: "TBCMS0027",
      measures: [
        {
          aggregation: "SUM",
          column: "QTDDISPONIVEL",
          label: "Disponível",
          unit: "number",
        },
      ],
      groupBy: { kind: "none" },
      dateFilter: null,
      filters: [],
      salesFilter: null,
      orderBy: "measureDesc",
      limit: 20,
    },
  },
  {
    key: "wms-disponivel-por-filial",
    category: "WMS",
    label: "Disponível por filial (WMS)",
    description: "Onde está o estoque separável, por centro de distribuição.",
    displayType: "LIST",
    config: {
      version: 1,
      table: "TBCMS0027",
      measures: [
        {
          aggregation: "SUM",
          column: "QTDDISPONIVEL",
          label: "Disponível",
          unit: "number",
        },
      ],
      groupBy: { kind: "dimension", column: "CODFILIAL" },
      dateFilter: null,
      filters: [],
      salesFilter: null,
      orderBy: "measureDesc",
      limit: 20,
    },
  },
  {
    // A diferença entre "tem no armazém" e "dá para separar": geral menos o
    // que está reservado, bloqueado ou avariado.
    key: "wms-posicao-produto",
    category: "WMS",
    label: "Posição no armazém por produto",
    description:
      "Geral, disponível, reservado, bloqueado e avariado por produto — o que trava a separação.",
    displayType: "TABLE",
    config: {
      version: 1,
      table: "TBCMS0027",
      measures: [
        {
          aggregation: "SUM",
          column: "QTDESTGERAL",
          label: "Geral",
          unit: "number",
        },
        {
          aggregation: "SUM",
          column: "QTDDISPONIVEL",
          label: "Disponível",
          unit: "number",
        },
        {
          aggregation: "SUM",
          column: "QTDESTRESERVADO",
          label: "Reservado",
          unit: "number",
        },
        {
          aggregation: "SUM",
          column: "QTDESTBLOQUEADO",
          label: "Bloqueado",
          unit: "number",
        },
        {
          aggregation: "SUM",
          column: "QTDESTAVARIADO",
          label: "Avariado",
          unit: "number",
        },
      ],
      groupBy: { kind: "dimension", column: "CODPROD" },
      dateFilter: null,
      filters: [{ column: "QTDESTGERAL", operator: "gt", values: [0] }],
      salesFilter: null,
      orderBy: "measureDesc",
      limit: 100,
    },
  },
  {
    // UM modelo só para retenção, não dois. Medido nesta base: em 89.675 das
    // 89.795 linhas (99,87%) QTDESTAVARIADO é IGUAL a QTDESTBLOQUEADO — só 29
    // divergem. Separar "avariado" de "bloqueado" produziria dois widgets com
    // listas idênticas, o que passa a impressão falsa de serem duas medições.
    // Usa QTDESTBLOQUEADO, que é a mais abrangente (864 linhas positivas
    // contra 790); quem precisar da diferença vê as duas colunas lado a lado
    // em "Posição no armazém por produto".
    key: "wms-retido",
    category: "WMS",
    label: "Estoque retido (WMS)",
    description:
      "Produtos com saldo bloqueado/avariado — não entra em separação até tratar.",
    displayType: "LIST",
    config: {
      version: 1,
      table: "TBCMS0027",
      measures: [
        {
          aggregation: "SUM",
          column: "QTDESTBLOQUEADO",
          label: "Retido",
          unit: "number",
        },
      ],
      groupBy: { kind: "dimension", column: "CODPROD" },
      dateFilter: null,
      filters: [{ column: "QTDESTBLOQUEADO", operator: "gt", values: [0] }],
      salesFilter: null,
      orderBy: "measureDesc",
      limit: 50,
    },
  },
  {
    // Endereçamento: quanto volume está em cada rua do armazém. RUA é texto
    // livre e nem toda linha tem (medido: ~6 mil sem preencher) — essas caem
    // num grupo "—" em vez de sumirem.
    key: "wms-ocupacao-rua",
    category: "WMS",
    label: "Ocupação por rua (WMS)",
    description:
      "Volume endereçado em cada rua do armazém — ajuda a enxergar concentração.",
    displayType: "LIST",
    config: {
      version: 1,
      table: "TBCMS0027",
      measures: [
        {
          aggregation: "SUM",
          column: "QTDESTGERAL",
          label: "Volume",
          unit: "number",
        },
      ],
      groupBy: { kind: "dimension", column: "RUA" },
      dateFilter: null,
      filters: [{ column: "QTDESTGERAL", operator: "gt", values: [0] }],
      salesFilter: null,
      orderBy: "measureDesc",
      limit: 30,
    },
  },
  {
    key: "margem-filial",
    category: "Vendas",
    label: "Receita x custo por filial",
    description: "Base para acompanhar margem, mês corrente.",
    displayType: "TABLE",
    config: {
      version: 1,
      table: "PCPEDC",
      measures: [
        receita(),
        {
          aggregation: "SUM",
          column: "VLCUSTOREAL",
          label: "Custo",
          unit: "currency",
        },
      ],
      groupBy: { kind: "dimension", column: "CODFILIAL" },
      dateFilter: { column: "DATA", preset: "currentMonth" },
      filters: [],
      salesFilter: "invoiced",
      orderBy: "measureDesc",
      limit: 20,
    },
  },
];
