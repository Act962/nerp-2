/**
 * O contrato entre o domínio e quem cobra.
 *
 * Nenhuma regra de pedido deve saber o que é Asaas. É o mesmo desenho que
 * `desktop-pagamento-eletronico.md` usa para o TEF: a porta descreve o que o
 * negócio precisa, e o adaptador sofre com o provedor.
 *
 * Sem DOM, sem Prisma, sem `server-only`: é só tipo, e é o que permite testar
 * a máquina de estados com um adaptador falso.
 */

export type MetodoDeCobranca = "PIX" | "BOLETO" | "CREDITO";

export type NovaCobranca = {
  /** Em reais. Centavos aqui viraria bug de fator 100 no primeiro descuido. */
  valor: number;
  metodo: MetodoDeCobranca;
  descricao: string;
  /** Nosso id — é por ele que o webhook reencontra a cobrança. */
  referencia: string;
  pagador: { nome: string; email: string; documento?: string };
  /** Para onde o provedor manda o cliente depois de pagar. */
  urlDeRetorno?: string;
};

/**
 * Estado da cobrança no provedor, já traduzido.
 *
 * `EXPIRADA` e `FALHOU` existem separados de propósito: a primeira é o cliente
 * que desistiu — o pedido pode ser refeito — e a segunda é recusa, que precisa
 * de outra forma de pagamento.
 */
export type EstadoDaCobranca =
  | "PENDENTE"
  | "PAGA"
  | "EXPIRADA"
  | "ESTORNADA"
  | "FALHOU";

export type CobrancaCriada = {
  /** Id no provedor. */
  externalId: string;
  estado: EstadoDaCobranca;
  /** Copia-e-cola do PIX, quando houver. */
  pixPayload?: string | null;
  /** PNG em base64 do QR, quando houver. */
  pixQrImage?: string | null;
  /** Página de pagamento hospedada pelo provedor. */
  urlDePagamento?: string | null;
  expiraEm?: Date | null;
};

export interface ProvedorDePagamento {
  readonly nome: string;
  criarCobranca(entrada: NovaCobranca): Promise<CobrancaCriada>;
  consultarCobranca(externalId: string): Promise<EstadoDaCobranca>;
}
