import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import {
  KitchenOrderActorType,
  KitchenOrderEventType,
  SaleStatus,
} from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import { recordOrderEvent } from "@/lib/pedidos/order-events";
import z from "zod";

/**
 * O dono recusa o pedido do cardápio: arquiva os itens e cancela a venda.
 *
 * Cancelar importa para o relatório — `PENDING_APPROVAL` já fica fora do
 * faturamento, mas venda recusada que continua pendente polui a fila do PDV e
 * o número de pedidos do dia.
 */
export const rejectTicket = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Recusar pedido do cardápio",
    tags: ["kitchen"],
  })
  .input(
    z.object({
      ticketId: z.string().min(1),
      reason: z.string().max(200).optional(),
    }),
  )
  .output(z.object({ rejected: z.number() }))
  .handler(async ({ context, input, errors }) => {
    const organizationId = context.org.id;

    const orders = await prisma.kitchenOrder.findMany({
      where: { organizationId, ticketId: input.ticketId, acceptedAt: null },
      select: {
        id: true,
        organizationId: true,
        tableNumber: true,
        dishName: true,
        attendantId: true,
        attendantName: true,
        attendantPhoto: true,
        saleId: true,
        column: { select: { id: true, name: true } },
      },
    });

    if (orders.length === 0) {
      throw errors.NOT_FOUND({
        message: "Pedido não encontrado ou já aceito.",
      });
    }

    const now = new Date();
    const saleId = orders.find((order) => order.saleId)?.saleId ?? null;
    const reason = input.reason?.trim();

    const rejected = await prisma.$transaction(async (tx) => {
      const result = await tx.kitchenOrder.updateMany({
        where: { organizationId, ticketId: input.ticketId, acceptedAt: null },
        data: { archivedAt: now },
      });

      if (saleId) {
        await tx.sale.updateMany({
          where: {
            id: saleId,
            organizationId,
            status: SaleStatus.PENDING_APPROVAL,
          },
          data: {
            status: SaleStatus.CANCELLED,
            cancelledAt: now,
            notes: reason
              ? `Pedido recusado: ${reason}`
              : "Pedido do cardápio recusado.",
          },
        });
      }

      return result.count;
    });

    const actor = {
      type: KitchenOrderActorType.USER,
      userId: context.user.id,
      name: context.user.name ?? context.user.email ?? "Usuário",
      photoUrl: context.user.image ?? null,
    };

    await Promise.all(
      orders.map((order) =>
        recordOrderEvent({
          type: KitchenOrderEventType.REJECTED,
          order: {
            id: order.id,
            organizationId: order.organizationId,
            tableNumber: order.tableNumber,
            dishName: order.dishName,
            attendantId: order.attendantId,
            attendantName: order.attendantName,
            attendantPhoto: order.attendantPhoto,
          },
          fromColumn: { id: order.column.id, name: order.column.name },
          actor,
        }),
      ),
    );

    return { rejected };
  });
