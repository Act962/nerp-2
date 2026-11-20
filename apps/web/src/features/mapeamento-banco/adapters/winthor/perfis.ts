import type { TipoDoNerp } from "../../domain/alvos";
import type { PerfilAutomatico } from "../../domain/perfis";

// Perfis automáticos do Winthor padrão — o ÚNICO lugar da feature com nome de
// tabela do Winthor. Em ordem de preferência por tipo: vale o primeiro cujas
// tabelas e colunas a credencial do cliente enxerga, e os recusados aparecem
// na tela com o motivo.
//
// Os perfis de PCTABPR e PCPRECOPROM foram escritos sem ver essas tabelas (o
// Armazém Carvalho não libera leitura nelas). Se uma coluna tiver outro nome no
// cliente, o perfil é recusado pela validação, com a coluna citada — e o
// mapeamento manual cobre.

const produto: PerfilAutomatico = {
  chave: "winthor-produto",
  tipo: "produto",
  rotulo: "Cadastro de produtos (PCPRODUT)",
  descricao:
    "O cadastro padrão do Winthor; fora de linha = data de exclusão preenchida.",
  tabela: "PCPRODUT",
  colunas: {
    codigo: { de: "base", nome: "CODPROD" },
    nome: { de: "base", nome: "DESCRICAO" },
    ean: { de: "base", nome: "CODAUXILIAR" },
    unidade: { de: "base", nome: "UNIDADE" },
    ativo: { de: "base", nome: "DTEXCLUSAO" },
    unidadesPorCaixa: { de: "base", nome: "QTUNITCX" },
    codigoCategoria: { de: "base", nome: "CODSEC" },
  },
  // CODAUXILIAR é o EAN da unidade quando existe; quando não, o Winthor repete
  // o próprio CODPROD ali — a conversão barra esse "EAN" falso.
  conversoes: { ativo: "vazioEhVerdadeiro", ean: "gtinValido" },
};

const estoque: PerfilAutomatico = {
  chave: "winthor-estoque",
  tipo: "estoque",
  rotulo: "Estoque por filial (PCEST)",
  descricao: "Saldo gerencial por filial, com o nome da filial do cadastro.",
  tabela: "PCEST",
  juncao: { tabela: "PCFILIAL", de: "CODFILIAL", para: "CODIGO" },
  colunas: {
    codigoProduto: { de: "base", nome: "CODPROD" },
    filial: { de: "base", nome: "CODFILIAL" },
    // QTESTGER é o gerencial: inclui o reservado em pedido e o bloqueado por
    // avaria. No Purelac 1kg (filial 2): 6.800 − 1.130 − 1.550 = 4.120 à venda.
    quantidade: { de: "base", nome: "QTESTGER" },
    reservada: { de: "base", nome: "QTRESERV" },
    bloqueada: { de: "base", nome: "QTBLOQUEADA" },
    nomeFilial: { de: "juncao", nome: "FANTASIA" },
  },
};

const categoria: PerfilAutomatico = {
  chave: "winthor-categoria",
  tipo: "categoria",
  rotulo: "Seções e departamentos (PCSECAO + PCDEPTO)",
  descricao: "Cada seção vira categoria, filha do seu departamento.",
  tabela: "PCSECAO",
  juncao: { tabela: "PCDEPTO", de: "CODEPTO", para: "CODEPTO" },
  colunas: {
    codigo: { de: "base", nome: "CODSEC" },
    nome: { de: "base", nome: "DESCRICAO" },
    codigoPai: { de: "base", nome: "CODEPTO" },
    nomePai: { de: "juncao", nome: "DESCRICAO" },
  },
};

const cliente: PerfilAutomatico = {
  chave: "winthor-cliente",
  tipo: "cliente",
  rotulo: "Cadastro de clientes (PCCLIENT)",
  descricao:
    "O cadastro padrão do Winthor; inativo = data de exclusão preenchida.",
  tabela: "PCCLIENT",
  colunas: {
    codigo: { de: "base", nome: "CODCLI" },
    nome: { de: "base", nome: "CLIENTE" },
    fantasia: { de: "base", nome: "FANTASIA" },
    documento: { de: "base", nome: "CGCENT" },
    telefone: { de: "base", nome: "TELENT" },
    celular: { de: "base", nome: "TELCELENT" },
    email: { de: "base", nome: "EMAIL" },
    // MUNICENT tem 15 caracteres: cidade longa chega cortada ("SAO RAIMUNDO NO").
    cidade: { de: "base", nome: "MUNICENT" },
    uf: { de: "base", nome: "ESTENT" },
    ativo: { de: "base", nome: "DTEXCLUSAO" },
    // BLOQUEIO = 'S' é bloqueio de crédito (45% da carteira do Armazém), não
    // cliente inativo — por isso campo próprio.
    bloqueado: { de: "base", nome: "BLOQUEIO" },
    vendedor: { de: "base", nome: "CODUSUR1" },
  },
  conversoes: {
    ativo: "vazioEhVerdadeiro",
    bloqueado: "simEhVerdadeiro",
    documento: "somenteDigitos",
    telefone: "somenteDigitos",
    celular: "somenteDigitos",
  },
};

const precoPorTabela: PerfilAutomatico = {
  chave: "winthor-preco-tabela",
  tipo: "preco",
  rotulo: "Tabela de preço por região (PCTABPR)",
  descricao:
    "O preço de tabela vigente de cada região — cobre também produto sem venda recente.",
  tabela: "PCTABPR",
  colunas: {
    codigoProduto: { de: "base", nome: "CODPROD" },
    preco: { de: "base", nome: "PVENDA" },
    regiao: { de: "base", nome: "NUMREGIAO" },
  },
  filtros: [
    {
      coluna: { de: "base", nome: "PVENDA" },
      operador: "preenchido",
      valores: [],
    },
  ],
};

// Reserva quando a tabela de preço não está liberada: o último preço de tabela
// praticado em pedido não cancelado, por produto e região, nos últimos 90 dias.
// A região está no cabeçalho do pedido (PCPEDC), não no item.
const precoPelasVendas: PerfilAutomatico = {
  chave: "winthor-preco-vendas",
  tipo: "preco",
  rotulo: "Último preço vendido (PCPEDI + PCPEDC)",
  descricao:
    "Sem acesso à tabela de preço: o último preço de tabela praticado por região em 90 dias. Produto sem venda no período fica sem preço.",
  tabela: "PCPEDI",
  juncao: { tabela: "PCPEDC", de: "NUMPED", para: "NUMPED" },
  colunas: {
    codigoProduto: { de: "base", nome: "CODPROD" },
    preco: { de: "base", nome: "PTABELA" },
    regiao: { de: "juncao", nome: "NUMREGIAO" },
    data: { de: "base", nome: "DATA" },
  },
  filtros: [
    {
      coluna: { de: "base", nome: "POSICAO" },
      operador: "diferente",
      valores: ["C"],
    },
    {
      coluna: { de: "base", nome: "PTABELA" },
      operador: "maiorOuIgual",
      valores: [0.01],
    },
  ],
  janela: { coluna: { de: "base", nome: "DATA" }, dias: 90 },
};

const promocao: PerfilAutomatico = {
  chave: "winthor-promocao",
  tipo: "promocao",
  rotulo: "Preço promocional por região (PCPRECOPROM)",
  descricao: "Preço fixo promocional com início e fim de vigência.",
  tabela: "PCPRECOPROM",
  colunas: {
    codigoProduto: { de: "base", nome: "CODPROD" },
    precoPromocional: { de: "base", nome: "PRECOFIXO" },
    inicio: { de: "base", nome: "DTINICIOVIGENCIA" },
    fim: { de: "base", nome: "DTFIMVIGENCIA" },
    regiao: { de: "base", nome: "NUMREGIAO" },
  },
};

export const PERFIS_DO_WINTHOR: Record<TipoDoNerp, PerfilAutomatico[]> = {
  produto: [produto],
  estoque: [estoque],
  categoria: [categoria],
  cliente: [cliente],
  preco: [precoPorTabela, precoPelasVendas],
  promocao: [promocao],
};
