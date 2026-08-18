import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import z from "zod";

// Rota pública (sem requireAuth): tela do cliente que acompanha o próprio
// pedido via QR code. Confiança vem do orderId (cuid não-guessable) — devolve
// apenas o que o cliente precisa ver (mesa, prato, status).
export const publicCustomerOrder = base
  .route({
    method: "GET",
    summary: "Status público do pedido (cliente)",
    tags: ["kitchen"],
  })
  .input(z.object({ orderId: z.string().min(1) }))
  .output(
    z.object({
      id: z.string(),
      tableNumber: z.string(),
      dishName: z.string(),
      notes: z.string().nullable(),
      columnName: z.string(),
      columnColor: z.string(),
      isReady: z.boolean(),
      isDone: z.boolean(),
      attendantName: z.string().nullable(),
      attendantPhoto: z.string().nullable(),
      createdAt: z.string(),
      columnEnteredAt: z.string(),
      estimatedMinutes: z.number().nullable(),
      orgSlug: z.string(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const order = await prisma.kitchenOrder.findUnique({
      where: { id: input.orderId },
      include: {
        column: {
          select: {
            name: true,
            color: true,
            isFinal: true,
            showOnTv: true,
          },
        },
        organization: { select: { slug: true } },
      },
    });

    if (!order) {
      throw errors.NOT_FOUND({ message: "Pedido não encontrado!" });
    }

    const isReady = order.column.showOnTv && !order.archivedAt;
    const isDone = order.column.isFinal || order.archivedAt != null;

    return {
      id: order.id,
      tableNumber: order.tableNumber,
      dishName: order.dishName,
      notes: order.notes,
      columnName: order.column.name,
      columnColor: order.column.color,
      isReady,
      isDone,
      attendantName: order.attendantName,
      attendantPhoto: order.attendantPhoto,
      createdAt: order.createdAt.toISOString(),
      columnEnteredAt: order.columnEnteredAt.toISOString(),
      estimatedMinutes: order.estimatedMinutes,
      orgSlug: order.organization.slug,
    };
  });
