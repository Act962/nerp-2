import type { DestinoPedido } from "@/generated/prisma/enums";

/**
 * Porta de saída do pedido confirmado. `NATIVO` é o próprio NERP: o pedido já
 * está no receptor e segue para o faturamento aqui. Um ERP externo (Winthor)
 * implementa `enviar` gravando o pedido nas tabelas de integração dele e
 * devolvendo o número que recebeu.
 */
export type PedidoParaDestino = {
  organizationId: string;
  saleId: string;
  numero: number;
  tipo: "VENDA" | "ORCAMENTO" | "BONIFICACAO" | "TROCA";
  cliente: {
    id: string;
    nome: string;
    documento: string | null;
    codigoErp: string | null;
  };
  vendedor: { memberId: string | null; codigoErp: string | null };
  condicao: { nome: string; prazosDias: number[] } | null;
  itens: Array<{
    productId: string;
    codigoErp: string | null;
    nome: string;
    quantidade: number;
    precoUnitario: number;
  }>;
  total: number;
  observacao: string | null;
};

export type ResultadoEnvio =
  | { status: "ACEITO"; referencia: string }
  | { status: "RECUSADO"; erro: string }
  | { status: "ERRO"; erro: string };

export interface DestinoDePedido {
  readonly tipo: DestinoPedido;
  enviar(pedido: PedidoParaDestino): Promise<ResultadoEnvio>;
}
