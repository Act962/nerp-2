import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireFunnelDaOrg } from "@/app/router/crm/_access";
import prisma from "@/lib/db";

/**
 * Caixa de entrada de um funil.
 *
 * Ordena por `lastMessageAt` decrescente — quem falou por último sobe. A
 * paginação é por cursor e não por página numerada: a lista muda de ordem
 * sozinha enquanto o atendente rola, e `skip/take` faria conversa repetir ou
 * sumir entre uma página e outra.
 *
 * O contador de não-lidas conta `seen: false` **das mensagens recebidas** — a
 * própria resposta do atendente não pode aparecer como pendente.
 */
export const listConversations = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Lista as conversas do funil",
    tags: ["Chat"],
  })
  .input(
    z.object({
      funnelId: z.string().min(1),
      busca: z.string().trim().optional(),
      statusFlow: z.enum(["NEW", "ACTIVE", "WAITING", "FINISHED"]).optional(),
      /** `lastMessageAt` da última conversa da página anterior, em ISO. */
      cursor: z.string().optional(),
      limite: z.number().int().min(1).max(50).default(20),
    }),
  )
  .output(
    z.object({
      conversas: z.array(
        z.object({
          id: z.string(),
          leadId: z.string(),
          nome: z.string(),
          telefone: z.string().nullable(),
          customerId: z.string().nullable(),
          statusFlow: z.enum(["NEW", "ACTIVE", "WAITING", "FINISHED"]),
          naoLidas: z.number(),
          lastMessageAt: z.string(),
          previa: z
            .object({
              corpo: z.string().nullable(),
              tipoDeMidia: z.string().nullable(),
              fromMe: z.boolean(),
            })
            .nullable(),
        }),
      ),
      proximoCursor: z.string().nullable(),
    }),
  )
  .handler(async ({ input, context }) => {
    const organizationId = context.org.id;
    await requireFunnelDaOrg(input.funnelId, organizationId);

    const busca = input.busca?.trim();

    const conversas = await prisma.conversation.findMany({
      where: {
        organizationId,
        funnelId: input.funnelId,
        ...(input.cursor
          ? { lastMessageAt: { lt: new Date(input.cursor) } }
          : {}),
        lead: {
          ...(input.statusFlow ? { statusFlow: input.statusFlow } : {}),
          // Arquivado sai da caixa de entrada. Com busca ativa volta a
          // aparecer: quem procura por nome quer achar mesmo o que arquivou.
          ...(busca
            ? {
                OR: [
                  { name: { contains: busca, mode: "insensitive" as const } },
                  { phone: { contains: busca } },
                ],
              }
            : { isArchived: false }),
        },
      },
      orderBy: { lastMessageAt: "desc" },
      take: input.limite,
      select: {
        id: true,
        lastMessageAt: true,
        lead: {
          select: {
            id: true,
            name: true,
            phone: true,
            customerId: true,
            statusFlow: true,
          },
        },
        lastMessage: {
          select: { body: true, mediaType: true, fromMe: true },
        },
        _count: {
          select: { messages: { where: { seen: false, fromMe: false } } },
        },
      },
    });

    const ultima = conversas.at(-1);

    return {
      conversas: conversas.map((conversa) => ({
        id: conversa.id,
        leadId: conversa.lead.id,
        nome: conversa.lead.name,
        telefone: conversa.lead.phone,
        customerId: conversa.lead.customerId,
        statusFlow: conversa.lead.statusFlow,
        naoLidas: conversa._count.messages,
        lastMessageAt: conversa.lastMessageAt.toISOString(),
        previa: conversa.lastMessage
          ? {
              corpo: conversa.lastMessage.body,
              tipoDeMidia: conversa.lastMessage.mediaType,
              fromMe: conversa.lastMessage.fromMe,
            }
          : null,
      })),
      // Só devolve cursor numa página cheia: página parcial já é o fim.
      proximoCursor:
        conversas.length === input.limite && ultima
          ? ultima.lastMessageAt.toISOString()
          : null,
    };
  });
