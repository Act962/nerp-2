import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { KitchenOrderActorType } from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import {
  classifyMoveEvent,
  recordOrderEvent,
} from "@/lib/pedidos/order-events";
import z from "zod";

/**
 * Move o pedido inteiro de coluna.
 *
 * É o botão primário do card no board: a cozinha raciocina por pedido, não por
 * item. O arrastar item a item continua existindo (`kitchen.move`) para quando
 * um item atrasa e o resto já pode seguir.
 */
export const moveKitchenTicket = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Mover pedido inteiro entre colunas",
    tags: ["kitchen"],
  })
  .input(z.object({ ticketId: z.string().min(1), toColumnId: z.string() }))
  .output(z.object({ moved: z.number() }))
  .handler(async ({ context, input, errors }) => {
    const organizationId = context.org.id;

    const toColumn = await prisma.kitchenColumn.findFirst({
      where: { id: input.toColumnId, organizationId },
      select: { id: true, name: true, isFinal: true, showOnTv: true },
    });

    if (!toColumn) {
      throw errors.BAD_REQUEST({ message: "Coluna destino inválida!" });
    }

    const orders = await prisma.kitchenOrder.findMany({
      where: {
        organizationId,
        ticketId: input.ticketId,
        archivedAt: null,
        acceptedAt: { not: null },
        columnId: { not: toColumn.id },
      },
      select: {
        id: true,
        organizationId: true,
        tableNumber: true,
        dishName: true,
        attendantId: true,
        attendantName: true,
        attendantPhoto: true,
        column: { select: { id: true, name: true } },
      },
    });

    if (orders.length === 0) return { moved: 0 };

    const last = await prisma.kitchenOrder.aggregate({
      where: { columnId: toColumn.id },
      _max: { position: true },
    });
    let position = (last._max.position ?? -1) + 1;
    const now = new Date();

    await prisma.$transaction(
      orders.map((order) =>
        prisma.kitchenOrder.update({
          where: { id: order.id },
          data: {
            columnId: toColumn.id,
            columnEnteredAt: now,
            position: position++,
          },
        }),
      ),
    );

    const actor = {
      type: KitchenOrderActorType.USER,
      userId: context.user.id,
      name: context.user.name ?? context.user.email ?? "Usuário",
      photoUrl: context.user.image ?? null,
    };

    await Promise.all(
      orders.map((order) =>
        recordOrderEvent({
          type: classifyMoveEvent(toColumn),
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
          toColumn: { id: toColumn.id, name: toColumn.name },
          actor,
        }),
      ),
    );

    return { moved: orders.length };
  });
