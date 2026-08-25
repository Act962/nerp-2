import "server-only";

// Tradução dos nomes técnicos do Winthor para linguagem de negócio.
//
// Existe porque `PCMOV`, `CODOPER` e `VLTOTAL` não significam nada para quem
// não convive com o ERP — e o montador de consultas é usado por gestor, não
// por DBA. Cada entrada dá um rótulo curto (o que aparece grande) e uma
// explicação (o que aparece na letra miúda e no hover).
//
// Nome fora do glossário não quebra nada: cai no próprio código, que continua
// sendo a informação correta, só sem tradução.

interface Term {
  label: string;
  description: string;
}

const TABLES: Record<string, Term> = {
  PCPEDC: {
    label: "Vendas (pedidos)",
    description:
      "Um registro por pedido de venda: valor total, cliente, vendedor, filial e situação. É daqui que sai o faturamento.",
  },
  PCPEDI: {
    label: "Vendas — itens vendidos",
    description:
      "Um registro por produto dentro de cada pedido. Use quando a pergunta é sobre produto, não sobre o pedido inteiro.",
  },
  PCMOV: {
    label: "Movimentações de estoque",
    description:
      "Toda entrada e saída de mercadoria: venda, compra, devolução, transferência e inventário. Não é o saldo atual, é o fluxo.",
  },
  PCCLIENT: {
    label: "Clientes",
    description:
      "Cadastro de clientes com endereço, contato e data da última compra.",
  },
  PCPRODUT: {
    label: "Produtos",
    description:
      "Cadastro de produtos: descrição, código de barras, marca, departamento e validade.",
  },
  PCUSUARI: {
    label: "Vendedores",
    description: "Cadastro da equipe de vendas e a qual supervisor responde.",
  },
  PCSUPERV: {
    label: "Supervisores",
    description: "Cadastro dos supervisores — a divisão comercial das equipes.",
  },
  PCFILIAL: {
    label: "Filiais",
    description: "Cadastro das filiais da empresa.",
  },
  PCFORNEC: {
    label: "Fornecedores",
    description: "Cadastro de fornecedores com contato e dados fiscais.",
  },
  PCMARCA: { label: "Marcas", description: "Marcas usadas nos produtos." },
  PCDEPTO: {
    label: "Departamentos",
    description: "Maior nível da classificação de produtos.",
  },
  PCSECAO: {
    label: "Seções",
    description: "Subdivisão do departamento na classificação de produtos.",
  },
  PCMETA: {
    label: "Metas",
    description: "Metas de venda lançadas por vendedor e período.",
  },
  PCMETARCA: {
    label: "Metas por marca",
    description: "Metas de venda abertas por marca.",
  },
};

const COLUMNS: Record<string, Term> = {
  // Valores
  VLTOTAL: {
    label: "Valor total",
    description: "Valor do pedido já com descontos. É a receita da venda.",
  },
  VLCUSTOREAL: {
    label: "Custo real",
    description: "Quanto a mercadoria custou. Receita menos custo = margem.",
  },
  VLCUSTOFIN: {
    label: "Custo financeiro",
    description: "Custo com encargos financeiros embutidos.",
  },
  VLTABELA: {
    label: "Valor de tabela",
    description: "Valor antes de desconto, pelo preço cheio.",
  },
  VLDESCONTO: {
    label: "Desconto",
    description: "Valor abatido do preço de tabela.",
  },
  VLFRETE: { label: "Frete", description: "Valor do frete no pedido." },
  VLBONIFIC: {
    label: "Bonificação",
    description: "Valor dado em bonificação (mercadoria sem cobrança).",
  },
  VLATEND: {
    label: "Valor atendido",
    description: "Parte do pedido efetivamente atendida.",
  },
  TOTPESO: { label: "Peso total", description: "Peso do pedido em quilos." },
  TOTVOLUME: {
    label: "Volume total",
    description: "Volume do pedido (cubagem).",
  },
  QT: {
    label: "Quantidade",
    description: "Quantidade movimentada ou vendida do produto.",
  },
  QTCONT: {
    label: "Quantidade conferida",
    description: "Quantidade após conferência física.",
  },
  NUMITENS: {
    label: "Nº de itens",
    description: "Quantos produtos diferentes tem o pedido.",
  },

  // Códigos e dimensões
  CODFILIAL: { label: "Filial", description: "Filial que fez a operação." },
  CODCLI: { label: "Cliente", description: "Cliente da operação." },
  CODUSUR: {
    label: "Vendedor",
    description: "Vendedor responsável (RCA, no jargão do Winthor).",
  },
  CODSUPERVISOR: {
    label: "Supervisor",
    description: "Supervisor da equipe do vendedor.",
  },
  CODPROD: { label: "Produto", description: "Produto da linha." },
  CODFORNEC: { label: "Fornecedor", description: "Fornecedor do produto." },
  CODMARCA: { label: "Marca", description: "Marca do produto." },
  CODEPTO: {
    label: "Departamento",
    description: "Maior nível da classificação do produto.",
  },
  CODSEC: {
    label: "Seção",
    description: "Subdivisão do departamento.",
  },
  NUMPED: {
    label: "Nº do pedido",
    description: "Número que identifica o pedido.",
  },
  CODPRACA: {
    label: "Praça",
    description: "Região de atendimento do cliente.",
  },
  CODCOB: { label: "Cobrança", description: "Forma de cobrança do pedido." },
  UNIDADE: { label: "Unidade", description: "Unidade de venda (UN, CX, KG…)." },
  CODAUXILIAR: {
    label: "Código de barras",
    description: "EAN/GTIN do produto.",
  },
  DESCRICAO: { label: "Descrição", description: "Nome do produto." },
  CLIENTE: { label: "Razão social", description: "Nome oficial do cliente." },
  FANTASIA: { label: "Nome fantasia", description: "Nome comercial." },

  // Os três campos que mais confundem
  POSICAO: {
    label: "Situação do pedido",
    description:
      "F = faturado, C = cancelado, L = liberado, M = montado, P = pendente, B = bloqueado.",
  },
  CONDVENDA: {
    label: "Condição de venda",
    description:
      "1 = venda normal. Outros valores são bonificação, troca, brinde e afins — por isso o filtro 'Tipo de venda' existe.",
  },
  CODOPER: {
    label: "Tipo de movimento",
    description:
      "Começa com E para entrada e S para saída. S = venda, E = compra, ED = devolução, ET/ST = transferência, EI/SI = inventário.",
  },
  STATUS: { label: "Status", description: "Situação do registro." },
  TIPOVENDA: {
    label: "Tipo de venda",
    description: "Modalidade da venda (normal, telemarketing, balcão…).",
  },

  // Datas
  DATA: {
    label: "Data do pedido",
    description: "Quando o pedido foi emitido. É a data usada no faturamento.",
  },
  DTMOV: {
    label: "Data do movimento",
    description: "Quando a mercadoria entrou ou saiu.",
  },
  DTFAT: { label: "Data de faturamento", description: "Quando foi faturado." },
  DTENTREGA: {
    label: "Data de entrega",
    description: "Quando o pedido foi ou será entregue.",
  },
  DTCANCEL: {
    label: "Data de cancelamento",
    description: "Quando o pedido foi cancelado.",
  },
  DTVENC: {
    label: "Validade",
    description: "Data de vencimento do produto no cadastro.",
  },
  DTULTCOMP: {
    label: "Última compra",
    description: "Quando o cliente comprou pela última vez.",
  },
  DTPRIMCOMPRA: {
    label: "Primeira compra",
    description: "Quando o cliente comprou pela primeira vez.",
  },
  DTCADASTRO: { label: "Cadastro", description: "Quando foi cadastrado." },
  DTULTVENDA: {
    label: "Última venda",
    description: "Quando o vendedor vendeu pela última vez.",
  },
  DTEXCLUSAO: {
    label: "Exclusão",
    description: "Quando o registro foi excluído. Vazio = ativo.",
  },
  DTNASC: { label: "Nascimento", description: "Data de nascimento." },
};

export function describeTable(name: string): Term {
  return TABLES[name] ?? { label: name, description: "" };
}

export function describeColumn(name: string): Term {
  return COLUMNS[name] ?? { label: name, description: "" };
}
