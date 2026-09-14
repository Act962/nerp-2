import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { aceitarTicket } from "@/lib/pedidos/aceitar-ticket";
import prisma from "@/lib/db";
import z from "zod";
import { requireMemberOfOrgSlug } from "./_require-member-of-org-slug";

const ticketSchema = z.object({
  ticketId: z.string(),
  tableNumber: z.string(),
  createdAt: z.string(),
  customerName: z.string().nullable(),
  customerPhone: z.string().nullable(),
  saleNumber: z.number().nullable(),
  total: z.number().nullable(),
  saleNotes: z.string().nullable(),
  /** "PIX · aguardando", "PIX · pago", ou null quando a loja não cobra online. */
  pagamento: z.string().nullable(),
  pago: z.boolean(),
  items: z.array(
    z.object({
      id: z.string(),
      dishName: z.string(),
      notes: z.string().nullable(),
    }),
  ),
});

/**
 * Pedidos do cardápio esperando liberação, no app do garçom.
 *
 * Exige vínculo com a organização, **não** a permissão `pedidos`: o gerente não
 * está sempre olhando o board, e o pedido não pode esperar por ele. Quem já
 * lança pedido pelo app é quem libera.
 */
export const waiterPendingTickets = base
  .use(requireAuthMiddleware)
  .route({
    method: "GET",
    summary: "Pedidos aguardando liberação (app do garçom)",
    tags: ["kitchen"],
  })
  .input(z.object({ orgSlug: z.string().min(1) }))
  .output(z.array(ticketSchema))
  .handler(async ({ input, context, errors }) => {
    const org = await requireMemberOfOrgSlug({
      orgSlug: input.orgSlug,
      userId: context.user.id,
      errors,
    });

    const pedidos = await prisma.kitchenOrder.findMany({
      where: {
        organizationId: org.id,
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
        createdAt: true,
        sale: {
          select: {
            saleNumber: true,
            total: true,
            notes: true,
            customer: { select: { name: true, phone: true } },
            charges: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { status: true, method: true },
            },
          },
        },
      },
    });

    const porTicket = new Map<string, z.infer<typeof ticketSchema>>();

    for (const pedido of pedidos) {
      const ticketId = pedido.ticketId;
      if (!ticketId) continue;

      let ticket = porTicket.get(ticketId);
      if (!ticket) {
        const venda = pedido.sale;
        const cobranca = venda?.charges[0];
        ticket = {
          ticketId,
          tableNumber: pedido.tableNumber,
          createdAt: pedido.createdAt.toISOString(),
          customerName: venda?.customer?.name ?? null,
          customerPhone: venda?.customer?.phone ?? null,
          saleNumber: venda?.saleNumber ?? null,
          total: venda ? Number(venda.total) : null,
          saleNotes: venda?.notes ?? null,
          pagamento: cobranca
            ? `${cobranca.method} · ${cobranca.status === "PAID" ? "pago" : "aguardando"}`
            : null,
          pago: cobranca?.status === "PAID",
          items: [],
        };
        porTicket.set(ticketId, ticket);
      }

      ticket.items.push({
        id: pedido.id,
        dishName: pedido.dishName,
        notes: pedido.notes,
      });
    }

    return [...porTicket.values()];
  });

/**
 * O garçom libera o pedido para a cozinha.
 *
 * O `attendantId` diz quem assinou; quem autoriza é a sessão. Mesma regra do
 * board — a diferença é só a trava de entrada.
 */
export const waiterAcceptTicket = base
  .use(requireAuthMiddleware)
  .route({
    method: "POST",
    summary: "Aceitar pedido (app do garçom)",
    tags: ["kitchen"],
  })
  .input(
    z.object({
      orgSlug: z.string().min(1),
      ticketId: z.string().min(1),
      attendantId: z.string().min(1),
    }),
  )
  .output(z.object({ accepted: z.number() }))
  .handler(async ({ input, context, errors }) => {
    const org = await requireMemberOfOrgSlug({
      orgSlug: input.orgSlug,
      userId: context.user.id,
      errors,
    });

    const atendente = await prisma.collaborator.findFirst({
      where: { id: input.attendantId, organizationId: org.id, isActive: true },
      select: { id: true, name: true, photoUrl: true },
    });

    const resultado = await aceitarTicket({
      organizationId: org.id,
      ticketId: input.ticketId,
      quem: atendente
        ? {
            tipo: "COLABORADOR",
            collaboratorId: atendente.id,
            nome: atendente.name,
            foto: atendente.photoUrl,
          }
        : {
            tipo: "USUARIO",
            userId: context.user.id,
            nome: context.user.name ?? "Equipe",
            foto: context.user.image ?? null,
          },
    });

    if (!resultado.ok) {
      throw resultado.motivo === "sem-coluna-inicial"
        ? errors.BAD_REQUEST({
            message: "Nenhuma coluna de entrada configurada para a cozinha!",
          })
        : errors.NOT_FOUND({ message: "Pedido não encontrado ou já aceito." });
    }

    return { accepted: resultado.aceitos };
  });
