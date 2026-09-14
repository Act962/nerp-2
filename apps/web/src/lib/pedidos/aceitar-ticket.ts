import "server-only";
import {
  KitchenOrderActorType,
  KitchenOrderEventType,
  SaleStatus,
} from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import { recordOrderEvent } from "./order-events";

export type QuemAceitou =
  | { tipo: "USUARIO"; userId: string; nome: string; foto?: string | null }
  | {
      tipo: "COLABORADOR";
      collaboratorId: string;
      nome: string;
      foto?: string | null;
    }
  | { tipo: "SISTEMA"; nome: string };

export type ResultadoDoAceite =
  | { ok: true; aceitos: number; ticketId: string }
  | { ok: false; motivo: "sem-pedido" | "sem-coluna-inicial" };

/**
 * Manda o pedido para a cozinha.
 *
 * Um lugar só porque três caminhos chegam aqui e precisam fazer exatamente a
 * mesma coisa: o dono pelo board, o garçom pelo app, e o webhook quando o
 * pagamento confirma. Duas implementações do que libera comida divergem no
 * primeiro ajuste — e a que divergir vai ser descoberta com o cliente na fila.
 *
 * Idempotente: filtra por `acceptedAt: null`, então dois cliques (ou o clique e
 * o webhook chegando juntos) não movem o pedido duas vezes.
 */
export async function aceitarTicket({
  organizationId,
  ticketId,
  quem,
}: {
  organizationId: string;
  ticketId: string;
  quem: QuemAceitou;
}): Promise<ResultadoDoAceite> {
  const pedidos = await prisma.kitchenOrder.findMany({
    where: { organizationId, ticketId, acceptedAt: null },
    select: {
      id: true,
      organizationId: true,
      tableNumber: true,
      dishName: true,
      attendantId: true,
      attendantName: true,
      attendantPhoto: true,
      saleId: true,
    },
  });

  if (pedidos.length === 0) return { ok: false, motivo: "sem-pedido" };

  const coluna = await prisma.kitchenColumn.findFirst({
    where: { organizationId, isInitial: true },
    select: { id: true, name: true },
  });

  if (!coluna) return { ok: false, motivo: "sem-coluna-inicial" };

  const ultima = await prisma.kitchenOrder.aggregate({
    where: { columnId: coluna.id },
    _max: { position: true },
  });
  let posicao = (ultima._max.position ?? -1) + 1;

  const agora = new Date();
  const saleId = pedidos.find((p) => p.saleId)?.saleId ?? null;

  const aceitos = await prisma.$transaction(async (tx) => {
    let contagem = 0;
    // Uma escrita por item porque `position` é individual; o filtro por
    // `acceptedAt` continua valendo linha a linha.
    for (const pedido of pedidos) {
      const resultado = await tx.kitchenOrder.updateMany({
        where: { id: pedido.id, acceptedAt: null },
        data: {
          acceptedAt: agora,
          columnId: coluna.id,
          columnEnteredAt: agora,
          position: posicao++,
        },
      });
      contagem += resultado.count;
    }

    if (saleId) {
      await tx.sale.updateMany({
        where: {
          id: saleId,
          organizationId,
          status: SaleStatus.PENDING_APPROVAL,
        },
        data: { status: SaleStatus.CONFIRMED },
      });
    }

    return contagem;
  });

  const ator =
    quem.tipo === "USUARIO"
      ? {
          type: KitchenOrderActorType.USER,
          userId: quem.userId,
          name: quem.nome,
          photoUrl: quem.foto ?? null,
        }
      : quem.tipo === "COLABORADOR"
        ? {
            type: KitchenOrderActorType.WAITER,
            collaboratorId: quem.collaboratorId,
            name: quem.nome,
            photoUrl: quem.foto ?? null,
          }
        : {
            type: KitchenOrderActorType.SYSTEM,
            name: quem.nome,
            photoUrl: null,
          };

  await Promise.all(
    pedidos.map((pedido) =>
      recordOrderEvent({
        type: KitchenOrderEventType.ACCEPTED,
        order: {
          id: pedido.id,
          organizationId: pedido.organizationId,
          tableNumber: pedido.tableNumber,
          dishName: pedido.dishName,
          attendantId: pedido.attendantId,
          attendantName: pedido.attendantName,
          attendantPhoto: pedido.attendantPhoto,
        },
        toColumn: { id: coluna.id, name: coluna.name },
        actor: ator,
      }),
    ),
  );

  return { ok: true, aceitos, ticketId };
}

/** O ticket ainda não aceito de uma venda, quando existir. */
export async function ticketPendenteDaVenda(
  saleId: string,
): Promise<{ organizationId: string; ticketId: string } | null> {
  const pedido = await prisma.kitchenOrder.findFirst({
    where: {
      saleId,
      acceptedAt: null,
      archivedAt: null,
      ticketId: { not: null },
    },
    select: { organizationId: true, ticketId: true },
  });
  if (!pedido?.ticketId) return null;
  return { organizationId: pedido.organizationId, ticketId: pedido.ticketId };
}
