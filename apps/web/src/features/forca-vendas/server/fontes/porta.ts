/**
 * Porta dos dados comerciais que a Força de Vendas mostra ao vendedor e usa
 * para decidir o pedido: dívida do cliente, histórico de compras e estoque.
 *
 * O MVP lê tudo do próprio NERP (`nativa.ts`). Uma empresa que opera no
 * Winthor (ou em outro ERP) ganha um adaptador que implementa esta mesma
 * interface lendo o Oracle — a tela, as regras e o pedido não mudam.
 *
 * Os ids que entram e saem são sempre os do NERP (`Customer.id`,
 * `Product.id`); traduzir para o código do ERP (`erpCode`) é trabalho do
 * adaptador.
 */

export type OrigemDosDados = "NATIVO" | "WINTHOR";

export type ResumoFinanceiroCliente = {
  /** Vencido e não pago, em reais. */
  vencido: number;
  /** Tudo que está em aberto (vencido ou não), em reais. */
  emAberto: number;
  titulosVencidos: number;
  /** ISO da data do título vencido mais antigo. */
  vencimentoMaisAntigo: string | null;
};

export type TituloDoCliente = {
  id: string;
  customerId: string;
  descricao: string;
  valor: number;
  valorPago: number;
  vencimento: string;
  vencido: boolean;
  numeroDaVenda: number | null;
};

export type CompraDoCliente = {
  saleId: string;
  numero: number;
  data: string;
  total: number;
  itens: number;
};

export type CompraDoProduto = {
  numero: number;
  data: string;
  quantidade: number;
  precoUnitario: number;
};

export type EstoqueFilial = {
  codigo: string;
  nome: string | null;
  quantidade: number;
};

export type EstoqueDoProduto = {
  /** Saldo físico que o sistema conhece. */
  fisico: number;
  /** Pedidos da Força de Vendas aprovados ou em aprovação, ainda não faturados. */
  comprometido: number;
  /** Físico − comprometido. É o que o vendedor pode prometer. */
  disponivel: number;
  controlaEstoque: boolean;
  filiais: EstoqueFilial[];
};

export interface FonteComercial {
  readonly origem: OrigemDosDados;
  resumoFinanceiro(
    customerIds: string[],
  ): Promise<Map<string, ResumoFinanceiroCliente>>;
  titulosEmAberto(customerIds: string[]): Promise<TituloDoCliente[]>;
  ultimasCompras(
    customerId: string,
    limite: number,
  ): Promise<CompraDoCliente[]>;
  comprasDoProduto(
    customerId: string,
    productId: string,
    limite: number,
  ): Promise<CompraDoProduto[]>;
  /** Data da última compra de cada cliente (para "dias sem comprar"). */
  ultimaCompraPorCliente(customerIds: string[]): Promise<Map<string, string>>;
  estoque(productIds: string[]): Promise<Map<string, EstoqueDoProduto>>;
}

export const RESUMO_VAZIO: ResumoFinanceiroCliente = {
  vencido: 0,
  emAberto: 0,
  titulosVencidos: 0,
  vencimentoMaisAntigo: null,
};
