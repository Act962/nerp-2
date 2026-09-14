import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import z from "zod";

/**
 * Fila de pedidos do cardápio esperando o dono aceitar.
 *
 * Fica FORA do board de propósito: enquanto não houver pagamento online, o
 * aceite é o que separa um pedido de verdade de um trote, e um trote não pode
 * virar cupom impresso e comida na chapa.
 */
export const listPendingTickets = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Pedidos do cardápio aguardando aceite",
    tags: ["kitchen"],
  })
  .input(z.object({}))
  .output(
    z.array(
      z.object({
        ticketId: z.string(),
        tableNumber: z.string(),
        createdAt: z.string(),
        customerName: z.string().nullable(),
        customerPhone: z.string().nullable(),
        saleId: z.string().nullable(),
        saleNumber: z.number().nullable(),
        total: z.number().nullable(),
        saleNotes: z.string().nullable(),
        items: z.array(
          z.object({
            id: z.string(),
            dishName: z.string(),
            notes: z.string().nullable(),
            estimatedMinutes: z.number().nullable(),
          }),
        ),
      }),
    ),
  )
  .handler(async ({ context }) => {
    const orders = await prisma.kitchenOrder.findMany({
      where: {
        organizationId: context.org.id,
        acceptedAt: null,
        archivedAt: null,
        ticketId: { not: null },
      },
      orderBy: [{ createdAt: "asc" }, { position: "asc" }],
      select: {
        id: true,
        ticketId: true,
        tableNumber: true,
        dishName: true,
        notes: true,
        estimatedMinutes: true,
        createdAt: true,
        saleId: true,
        sale: {
          select: {
            id: true,
            saleNumber: true,
            total: true,
            notes: true,
            customer: { select: { name: true, phone: true } },
          },
        },
      },
    });

    const byTicket = new Map<
      string,
      ReturnType<typeof emptyTicket> & { items: typeof orders }
    >();

    for (const order of orders) {
      // `ticketId: { not: null }` já garante, mas o tipo do Prisma não sabe.
      const ticketId = order.ticketId;
      if (!ticketId) continue;

      let ticket = byTicket.get(ticketId);
      if (!ticket) {
        ticket = {
          ...emptyTicket(ticketId),
          tableNumber: order.tableNumber,
          createdAt: order.createdAt.toISOString(),
          customerName: order.sale?.customer?.name ?? null,
          customerPhone: order.sale?.customer?.phone ?? null,
          saleId: order.sale?.id ?? null,
          saleNumber: order.sale?.saleNumber ?? null,
          total: order.sale ? Number(order.sale.total) : null,
          saleNotes: order.sale?.notes ?? null,
          items: [],
        };
        byTicket.set(ticketId, ticket);
      }
      ticket.items.push(order);
    }

    return [...byTicket.values()].map((ticket) => ({
      ticketId: ticket.ticketId,
      tableNumber: ticket.tableNumber,
      createdAt: ticket.createdAt,
      customerName: ticket.customerName,
      customerPhone: ticket.customerPhone,
      saleId: ticket.saleId,
      saleNumber: ticket.saleNumber,
      total: ticket.total,
      saleNotes: ticket.saleNotes,
      items: ticket.items.map((item) => ({
        id: item.id,
        dishName: item.dishName,
        notes: item.notes,
        estimatedMinutes: item.estimatedMinutes,
      })),
    }));
  });

function emptyTicket(ticketId: string) {
  return {
    ticketId,
    tableNumber: "",
    createdAt: "",
    customerName: null as string | null,
    customerPhone: null as string | null,
    saleId: null as string | null,
    saleNumber: null as number | null,
    total: null as number | null,
    saleNotes: null as string | null,
  };
}
