import { base } from "@/app/middlewares/base";
import {
  KitchenOrderActorType,
  KitchenOrderEventType,
} from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import { recordOrderEvent } from "@/lib/pedidos/order-events";
import z from "zod";

// Rota pública (sem requireAuth): permite que o garçom (kiosk) marque um
// pedido como entregue ao cliente. A confiança vem do orgSlug + attendantId
// + orderId — só pode entregar pedidos da sua própria mesa/atendimento.
export const publicDeliver = base
  .route({
    method: "POST",
    summary: "Marcar pedido como entregue (kiosk do garçom)",
    tags: ["kitchen"],
  })
  .input(
    z.object({
      orgSlug: z.string().min(1),
      attendantId: z.string().min(1),
      orderId: z.string().min(1),
    }),
  )
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, errors }) => {
    const org = await prisma.organization.findUnique({
      where: { slug: input.orgSlug },
      select: { id: true },
    });

    if (!org) {
      throw errors.NOT_FOUND({ message: "Organização não encontrada!" });
    }

    const attendant = await prisma.collaborator.findFirst({
      where: { id: input.attendantId, organizationId: org.id, isActive: true },
      select: { id: true, name: true, photoUrl: true },
    });

    if (!attendant) {
      throw errors.BAD_REQUEST({ message: "Atendente inválido!" });
    }

    const order = await prisma.kitchenOrder.findFirst({
      where: {
        id: input.orderId,
        organizationId: org.id,
        attendantId: attendant.id,
      },
      select: {
        id: true,
        organizationId: true,
        tableNumber: true,
        dishName: true,
        attendantId: true,
        attendantName: true,
        attendantPhoto: true,
        archivedAt: true,
        column: { select: { id: true, name: true, isFinal: true } },
      },
    });

    if (!order) {
      throw errors.NOT_FOUND({
        message: "Pedido não encontrado para este atendente!",
      });
    }

    // Coluna terminal (isFinal): destino padrão para "entregue". Se a org não
    // tiver, marca diretamente como arquivado.
    const finalColumn = await prisma.kitchenColumn.findFirst({
      where: { organizationId: org.id, isFinal: true },
      select: { id: true, name: true },
    });

    let toColumn: { id: string; name: string } | null = null;

    if (finalColumn && order.column.id !== finalColumn.id) {
      const last = await prisma.kitchenOrder.aggregate({
        where: { columnId: finalColumn.id, id: { not: order.id } },
        _max: { position: true },
      });

      await prisma.kitchenOrder.update({
        where: { id: order.id },
        data: {
          columnId: finalColumn.id,
          columnEnteredAt: new Date(),
          position: (last._max.position ?? -1) + 1,
        },
      });
      toColumn = { id: finalColumn.id, name: finalColumn.name };
    } else if (!finalColumn && !order.archivedAt) {
      await prisma.kitchenOrder.update({
        where: { id: order.id },
        data: { archivedAt: new Date() },
      });
    }

    await recordOrderEvent({
      type: KitchenOrderEventType.DELIVERED,
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
      toColumn,
      actor: {
        type: KitchenOrderActorType.WAITER,
        collaboratorId: attendant.id,
        name: attendant.name,
        photoUrl: attendant.photoUrl,
      },
    });

    return { success: true };
  });
