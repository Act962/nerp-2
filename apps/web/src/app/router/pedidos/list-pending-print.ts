import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import z from "zod";

/**
 * Tickets aceitos que ainda não saíram na impressora.
 *
 * `acceptedAt IS NOT NULL AND printedAt IS NULL` — imprimir no ACEITE, não na
 * criação, é o que impede pedido não confirmado de virar papel. O backfill da
 * migration preencheu `printedAt` do histórico justamente para a estação não
 * despejar a bobina inteira no primeiro acesso.
 */
export const listPendingPrint = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Tickets aguardando impressão",
    tags: ["kitchen"],
  })
  .input(z.object({ limit: z.number().int().positive().max(20).optional() }))
  .output(
    z.array(
      z.object({
        ticketId: z.string(),
        tableNumber: z.string(),
        createdAt: z.string(),
        attendantName: z.string().nullable(),
        customerName: z.string().nullable(),
        saleNumber: z.number().nullable(),
        subtotal: z.number(),
        discount: z.number(),
        total: z.number(),
        items: z.array(
          z.object({
            name: z.string(),
            quantity: z.number(),
            unitPrice: z.number(),
            total: z.number(),
            notes: z.string().nullable(),
            estimatedMinutes: z.number().nullable(),
          }),
        ),
      }),
    ),
  )
  .handler(async ({ context, input }) => {
    const orders = await prisma.kitchenOrder.findMany({
      where: {
        organizationId: context.org.id,
        acceptedAt: { not: null },
        printedAt: null,
        archivedAt: null,
        ticketId: { not: null },
      },
      orderBy: [{ acceptedAt: "asc" }, { position: "asc" }],
      // Teto generoso: são itens, não tickets, e o limite existe só para a
      // estação não engasgar depois de um tempo desconectada.
      take: (input.limit ?? 10) * 20,
      select: {
        ticketId: true,
        tableNumber: true,
        dishName: true,
        notes: true,
        estimatedMinutes: true,
        attendantName: true,
        acceptedAt: true,
        createdAt: true,
        productId: true,
        sale: {
          select: {
            saleNumber: true,
            subtotal: true,
            discount: true,
            total: true,
            customer: { select: { name: true } },
            items: {
              select: {
                productId: true,
                productName: true,
                quantity: true,
                unitPrice: true,
                total: true,
                notes: true,
              },
            },
          },
        },
      },
    });

    type Ticket = z.infer<typeof ticketSchema>;
    const byTicket = new Map<string, Ticket>();

    for (const order of orders) {
      const ticketId = order.ticketId;
      if (!ticketId) continue;

      let ticket = byTicket.get(ticketId);
      if (!ticket) {
        const sale = order.sale;
        ticket = {
          ticketId,
          tableNumber: order.tableNumber,
          createdAt: (order.acceptedAt ?? order.createdAt).toISOString(),
          attendantName: order.attendantName,
          customerName: sale?.customer?.name ?? null,
          saleNumber: sale?.saleNumber ?? null,
          subtotal: sale ? Number(sale.subtotal) : 0,
          discount: sale ? Number(sale.discount) : 0,
          total: sale ? Number(sale.total) : 0,
          items: [],
        };
        byTicket.set(ticketId, ticket);
      }

      // Pedido nascido de venda tem preço na SaleItem; pedido do balcão não tem
      // preço nenhum e o cupom sai como comanda de cozinha, só com os itens.
      const saleItem = order.sale?.items.find(
        (item) => item.productId === order.productId,
      );

      ticket.items.push({
        name: order.dishName,
        quantity: saleItem ? Number(saleItem.quantity) : 1,
        unitPrice: saleItem ? Number(saleItem.unitPrice) : 0,
        total: saleItem ? Number(saleItem.total) : 0,
        notes: order.notes,
        estimatedMinutes: order.estimatedMinutes,
      });
    }

    return [...byTicket.values()].slice(0, input.limit ?? 10);
  });

const ticketSchema = z.object({
  ticketId: z.string(),
  tableNumber: z.string(),
  createdAt: z.string(),
  attendantName: z.string().nullable(),
  customerName: z.string().nullable(),
  saleNumber: z.number().nullable(),
  subtotal: z.number(),
  discount: z.number(),
  total: z.number(),
  items: z.array(
    z.object({
      name: z.string(),
      quantity: z.number(),
      unitPrice: z.number(),
      total: z.number(),
      notes: z.string().nullable(),
      estimatedMinutes: z.number().nullable(),
    }),
  ),
});
