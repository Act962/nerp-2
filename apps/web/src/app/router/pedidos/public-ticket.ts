import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import z from "zod";

/**
 * Acompanhamento do PEDIDO INTEIRO pelo cliente, via QR.
 *
 * A rota antiga por `orderId` continua existindo e intocada: há QR já impresso
 * apontando para ela. Esta é a que o cupom novo aponta, e mostra o pedido todo
 * — itens, valor e tempo — em vez de um item solto.
 *
 * A confiança é o `ticketId` (uuid não-adivinhável) — o mesmo modelo do
 * `orderId` de antes: quem tem o papel na mão tem o endereço.
 */
export const publicTicketOrder = base
  .route({
    method: "GET",
    summary: "Status público do pedido inteiro (cliente)",
    tags: ["kitchen"],
  })
  .input(z.object({ ticketId: z.string().min(1) }))
  .output(
    z.object({
      ticketId: z.string(),
      tableNumber: z.string(),
      orgSlug: z.string(),
      orgName: z.string(),
      isReady: z.boolean(),
      isDone: z.boolean(),
      isWaitingAcceptance: z.boolean(),
      createdAt: z.string(),
      startedAt: z.string().nullable(),
      estimatedMinutes: z.number().nullable(),
      total: z.number().nullable(),
      attendantName: z.string().nullable(),
      attendantPhoto: z.string().nullable(),
      items: z.array(
        z.object({
          id: z.string(),
          dishName: z.string(),
          notes: z.string().nullable(),
          columnName: z.string(),
          columnColor: z.string(),
          isReady: z.boolean(),
          isDone: z.boolean(),
        }),
      ),
    }),
  )
  .handler(async ({ input, errors }) => {
    const orders = await prisma.kitchenOrder.findMany({
      where: { ticketId: input.ticketId },
      orderBy: { position: "asc" },
      select: {
        id: true,
        dishName: true,
        notes: true,
        archivedAt: true,
        acceptedAt: true,
        createdAt: true,
        estimatedMinutes: true,
        attendantName: true,
        attendantPhoto: true,
        column: {
          select: { name: true, color: true, isFinal: true, showOnTv: true },
        },
        organization: { select: { slug: true, name: true } },
        sale: { select: { total: true } },
        tableNumber: true,
      },
    });

    if (orders.length === 0) {
      throw errors.NOT_FOUND({ message: "Pedido não encontrado!" });
    }

    const first = orders[0];

    const items = orders.map((order) => ({
      id: order.id,
      dishName: order.dishName,
      notes: order.notes,
      columnName: order.column.name,
      columnColor: order.column.color,
      isReady: order.column.showOnTv && !order.archivedAt,
      isDone: order.column.isFinal || order.archivedAt != null,
    }));

    // O pedido só está "pronto" quando o último item ficou pronto — entregar
    // metade da mesa e apagar o aviso seria pior que não avisar.
    const isDone = items.every((item) => item.isDone);
    const isReady =
      !isDone && items.every((item) => item.isReady || item.isDone);

    // Tempo do item mais demorado: é ele que define quando a bandeja sai.
    const estimatedMinutes = orders.reduce<number | null>((maior, order) => {
      if (order.estimatedMinutes == null) return maior;
      return maior == null
        ? order.estimatedMinutes
        : Math.max(maior, order.estimatedMinutes);
    }, null);

    const acceptedAt =
      orders.find((order) => order.acceptedAt)?.acceptedAt ?? null;

    return {
      ticketId: input.ticketId,
      tableNumber: first.tableNumber,
      orgSlug: first.organization.slug,
      orgName: first.organization.name,
      isReady,
      isDone,
      isWaitingAcceptance: acceptedAt == null,
      createdAt: first.createdAt.toISOString(),
      startedAt: acceptedAt ? acceptedAt.toISOString() : null,
      estimatedMinutes,
      total: first.sale ? Number(first.sale.total) : null,
      attendantName: first.attendantName,
      attendantPhoto: first.attendantPhoto,
      items,
    };
  });
