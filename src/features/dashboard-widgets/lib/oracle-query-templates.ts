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

export interface OracleQueryTemplate {
  key: string;
  label: string;
  description: string;
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
