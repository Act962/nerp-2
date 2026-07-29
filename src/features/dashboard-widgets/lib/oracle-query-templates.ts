import type { OracleQueryConfig } from "./oracle-query-config";

// Modelos prontos de consulta — ponto de partida para não começar do zero.
//
// Arquivo puro (client + server). Todos usam a semântica de venda correta
// (`salesFilter: "valid"` = mesma regra do ranking) e um período em coluna
// indexada, então nascem já dentro do que o pré-voo aceita.
//
// Se o Winthor do cliente não tiver a tabela do modelo, a UI desabilita o
// modelo em vez de deixar o usuário tomar erro no "Testar consulta".

export interface OracleQueryTemplate {
  key: string;
  label: string;
  description: string;
  displayType: "STAT" | "CHART" | "LIST" | "TABLE";
  config: OracleQueryConfig;
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
    key: "top-clientes",
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
  {
    key: "margem-filial",
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
