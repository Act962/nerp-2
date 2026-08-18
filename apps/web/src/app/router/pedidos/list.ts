import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import z from "zod";

export const listKitchenOrders = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Listar pedidos da cozinha",
    tags: ["kitchen"],
  })
  .input(
    z.object({
      columnId: z.string().optional(),
      // true = área de arquivados; padrão/false = board (só ativos)
      archived: z.boolean().optional(),
    }),
  )
  .output(
    z.array(
      z.object({
        id: z.string(),
        columnId: z.string(),
        tableNumber: z.string(),
        dishName: z.string(),
        notes: z.string().nullable(),
        estimatedMinutes: z.number().nullable(),
        position: z.number(),
        attendantId: z.string().nullable(),
        attendantName: z.string().nullable(),
        attendantPhoto: z.string().nullable(),
        createdByName: z.string().nullable(),
        createdAt: z.string(),
        columnEnteredAt: z.string(),
        archivedAt: z.string().nullable(),
      }),
    ),
  )
  .handler(async ({ context, input }) => {
    // O board mostra TODOS os pedidos ativos (inclusive os entregues na coluna
    // final): eles só saem do board quando arquivados. O auto-some por tempo
    // vale apenas para a TV (publicReady), não para a cozinha.
    const where: Prisma.KitchenOrderWhereInput = {
      organizationId: context.org.id,
      ...(input.columnId ? { columnId: input.columnId } : {}),
      archivedAt: input.archived ? { not: null } : null,
    };

    const orders = await prisma.kitchenOrder.findMany({
      where,
      orderBy: input.archived
        ? { archivedAt: "desc" }
        : [{ column: { position: "asc" } }, { position: "asc" }],
      include: {
        createdBy: { select: { name: true } },
      },
    });

    return orders.map(serializeOrder);
  });

function serializeOrder(order: {
  id: string;
  columnId: string;
  tableNumber: string;
  dishName: string;
  notes: string | null;
  estimatedMinutes: number | null;
  position: number;
  attendantId: string | null;
  attendantName: string | null;
  attendantPhoto: string | null;
  createdBy: { name: string } | null;
  createdAt: Date;
  columnEnteredAt: Date;
  archivedAt: Date | null;
}) {
  return {
    id: order.id,
    columnId: order.columnId,
    tableNumber: order.tableNumber,
    dishName: order.dishName,
    notes: order.notes,
    estimatedMinutes: order.estimatedMinutes,
    position: order.position,
    attendantId: order.attendantId,
    attendantName: order.attendantName,
    attendantPhoto: order.attendantPhoto,
    createdByName: order.createdBy?.name ?? null,
    createdAt: order.createdAt.toISOString(),
    columnEnteredAt: order.columnEnteredAt.toISOString(),
    archivedAt: order.archivedAt ? order.archivedAt.toISOString() : null,
  };
}
