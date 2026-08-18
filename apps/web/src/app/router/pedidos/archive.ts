import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import {
  KitchenOrderActorType,
  KitchenOrderEventType,
} from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import { recordOrderEvent } from "@/lib/pedidos/order-events";
import z from "zod";

// Arquiva (ou restaura) um pedido. Arquivado some do board e vai p/ a área de
// arquivados; não conta tempo nem aparece na TV (continua na coluna atual).
export const setArchivedKitchenOrder = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Arquivar/restaurar pedido da cozinha",
    tags: ["kitchen"],
  })
  .input(
    z.object({
      id: z.string(),
      archived: z.boolean(),
    }),
  )
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ context, input, errors }) => {
    const order = await prisma.kitchenOrder.findFirst({
      where: { id: input.id, organizationId: context.org.id },
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

    if (!order) {
      throw errors.NOT_FOUND({ message: "Pedido não encontrado!" });
    }

    await prisma.kitchenOrder.update({
      where: { id: input.id },
      data: { archivedAt: input.archived ? new Date() : null },
    });

    await recordOrderEvent({
      type: input.archived
        ? KitchenOrderEventType.ARCHIVED
        : KitchenOrderEventType.RESTORED,
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
      actor: {
        type: KitchenOrderActorType.USER,
        userId: context.user.id,
        name: context.user.name ?? context.user.email ?? "Usuário",
        photoUrl: context.user.image ?? null,
      },
    });

    return { success: true };
  });
