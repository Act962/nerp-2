import "server-only";

import type { DestinoPedido } from "@/generated/prisma/enums";
import type { DestinoDePedido } from "./porta";

export type { PedidoParaDestino, ResultadoEnvio } from "./porta";

// O pedido já mora no NERP: aceitar é só registrar que o receptor recebeu.
const nativo: DestinoDePedido = {
  tipo: "NATIVO",
  async enviar(pedido) {
    return { status: "ACEITO", referencia: `#${pedido.numero}` };
  },
};

// Lugar reservado para o adaptador do Winthor (F11b): gravar nas tabelas de
// integração de força de vendas por uma conexão com usuário só de INSERT,
// fora da camada só-leitura do `erp-sync`. Até lá, o pedido fica no NERP.
const winthor: DestinoDePedido = {
  tipo: "WINTHOR",
  async enviar() {
    return {
      status: "ERRO",
      erro: "Envio para o Winthor ainda não está disponível. O pedido segue no receptor do NERP.",
    };
  },
};

const DESTINOS: Record<DestinoPedido, DestinoDePedido> = {
  NATIVO: nativo,
  WINTHOR: winthor,
};

export function destinoDoPedido(tipo: DestinoPedido): DestinoDePedido {
  return DESTINOS[tipo];
}
