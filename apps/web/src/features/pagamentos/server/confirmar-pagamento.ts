import "server-only";
import { SaleStatus } from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import {
  aceitarTicket,
  ticketPendenteDaVenda,
} from "@/lib/pedidos/aceitar-ticket";
import { createKitchenOrdersFromSale } from "@/lib/pedidos/create-orders-from-sale";
import { liberaACozinha, paraChargeStatus } from "../lib/estado-da-cobranca";
import type { EstadoDaCobranca } from "../lib/porta";

export type ResultadoDaConfirmacao =
  | { ok: true; foiParaCozinha: boolean; ticketId: string | null }
  | { ok: false; motivo: "cobranca-desconhecida" | "ja-processada" };

/**
 * O que acontece quando o provedor diz que a cobrança mudou de estado.
 *
 * É o único caminho que manda pedido para a cozinha por pagamento, e está aqui
 * — fora da rota — porque o webhook e a consulta manual ("já paguei, confere
 * aí") precisam fazer exatamente a mesma coisa. Duas implementações do que
 * libera comida divergem no primeiro ajuste.
 *
 * Idempotente por construção: o `updateMany` filtra por `status: PENDING`, e
 * quem chegar depois recebe `count: 0` e não cria pedido nenhum. Reentrega do
 * provedor é regra, não exceção.
 */
export async function confirmarPagamento({
  provider,
  externalId,
  estado,
}: {
  provider: string;
  externalId: string;
  estado: EstadoDaCobranca;
}): Promise<ResultadoDaConfirmacao> {
  const cobranca = await prisma.charge.findUnique({
    where: { provider_externalId: { provider, externalId } },
    select: { id: true, saleId: true, status: true, organizationId: true },
  });

  if (!cobranca) return { ok: false, motivo: "cobranca-desconhecida" };

  const novoStatus = paraChargeStatus(estado);

  if (!liberaACozinha(estado)) {
    // Estado que não libera só atualiza o rastro. Expirada e estornada NÃO
    // desfazem pedido já enviado: tirar comida da chapa é decisão de gente.
    await prisma.charge.updateMany({
      where: { id: cobranca.id, status: "PENDING" },
      data: { status: novoStatus },
    });
    return { ok: true, foiParaCozinha: false, ticketId: null };
  }

  const agora = new Date();

  // A trava: só quem transicionar de PENDING para PAID segue adiante.
  const marcada = await prisma.charge.updateMany({
    where: { id: cobranca.id, status: "PENDING" },
    data: { status: "PAID", paidAt: agora },
  });

  if (marcada.count === 0) return { ok: false, motivo: "ja-processada" };

  if (!cobranca.saleId) {
    return { ok: true, foiParaCozinha: false, ticketId: null };
  }

  await prisma.sale.updateMany({
    where: { id: cobranca.saleId, status: SaleStatus.PENDING_APPROVAL },
    data: { status: SaleStatus.CONFIRMED, paidAt: agora },
  });

  // O checkout JÁ criou o ticket, esperando confirmação. Pagar é o que o
  // aceita. Criar outro aqui faria a cozinha receber o mesmo pedido duas vezes
  // — uma vez pelo checkout e outra pelo webhook.
  const pendente = await ticketPendenteDaVenda(cobranca.saleId);

  if (pendente) {
    const aceite = await aceitarTicket({
      organizationId: pendente.organizationId,
      ticketId: pendente.ticketId,
      quem: { tipo: "SISTEMA", nome: "Pagamento confirmado" },
    });
    return {
      ok: true,
      foiParaCozinha: aceite.ok,
      ticketId: aceite.ok ? aceite.ticketId : null,
    };
  }

  // Sem ticket pendente: venda criada por um caminho que não passa pela
  // cozinha (a loja online em modo MARKETPLACE, por exemplo). Aí sim cria.
  const ticketId = await createKitchenOrdersFromSale(cobranca.saleId, {
    requiresAcceptance: false,
  });

  return {
    ok: true,
    foiParaCozinha: Boolean(ticketId),
    ticketId: ticketId ?? null,
  };
}

/**
 * Registra o evento e diz se ele é novo.
 *
 * `false` significa "já vi este": o provedor reenvia quando não recebe 200 a
 * tempo, e sem esta trava o mesmo pedido entra duas vezes na cozinha.
 */
export async function registrarEvento(
  provider: string,
  eventId: string,
): Promise<boolean> {
  try {
    await prisma.processedWebhookEvent.create({ data: { provider, eventId } });
    return true;
  } catch {
    // Só a violação da unique cai aqui na prática; qualquer outra falha de
    // escrita também deve ser tratada como "não processe", que é o lado seguro.
    return false;
  }
}
