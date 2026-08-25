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

export const moveKitchenOrder = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Mover pedido entre colunas",
    tags: ["kitchen"],
  })
  .input(
    z.object({
      id: z.string(),
      toColumnId: z.string(),
    }),
  )
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ context, input, errors }) => {
    const organizationId = context.org.id;

    // Snapshot do pedido + coluna atual para alimentar o evento.
    const order = await prisma.kitchenOrder.findFirst({
      where: { id: input.id, organizationId },
      select: {
        id: true,
        organizationId: true,
        tableNumber: true,
        dishName: true,
        attendantId: true,
        attendantName: true,
        attendantPhoto: true,
        columnId: true,
        column: { select: { id: true, name: true } },
      },
    });

    if (!order) {
      throw errors.NOT_FOUND({ message: "Pedido não encontrado!" });
    }

    const toColumn = await prisma.kitchenColumn.findFirst({
      where: { id: input.toColumnId, organizationId },
      select: { id: true, name: true, isFinal: true, showOnTv: true },
    });

    if (!toColumn) {
      throw errors.BAD_REQUEST({ message: "Coluna destino inválida!" });
    }

    // Posição no fim da coluna destino (exclui o próprio card p/ ser idempotente).
    const last = await prisma.kitchenOrder.aggregate({
      where: { columnId: input.toColumnId, id: { not: input.id } },
      _max: { position: true },
    });

    await prisma.kitchenOrder.update({
      where: { id: input.id },
      data: {
        columnId: input.toColumnId,
        columnEnteredAt: new Date(),
        position: (last._max.position ?? -1) + 1,
      },
    });

    // Só registra evento se realmente trocou de coluna (evita ruído quando o
    // usuário solta o card na mesma coluna).
    if (order.columnId !== toColumn.id) {
      await recordOrderEvent({
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
        actor: {
          type: KitchenOrderActorType.USER,
          userId: context.user.id,
          name: context.user.name ?? context.user.email ?? "Usuário",
          photoUrl: context.user.image ?? null,
        },
      });
    }

    return { success: true };
  });
