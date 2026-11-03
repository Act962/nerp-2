import "server-only";

import { ORPCError } from "@orpc/server";
import prisma from "@/lib/db";
import type { ContextoVendedor } from "./escopo-equipe";

/**
 * As conversas que o vendedor atende: as do cliente da carteira dele e as dos
 * leads que já são responsabilidade dele. O número é o oficial da empresa —
 * a conversa fica no sistema mesmo se o vendedor sair.
 */
function filtroDeConversa(vendedor: ContextoVendedor) {
  if (vendedor.escopo.tipo === "TODOS") return {};
  return {
    lead: {
      OR: [
        { responsibleId: vendedor.userId },
        {
          customer: {
            carteiras: {
              some: { memberId: { in: vendedor.escopo.memberIds } },
            },
          },
        },
      ],
    },
  };
}

export async function listarConversas(args: {
  organizationId: string;
  vendedor: ContextoVendedor;
  busca?: string | null;
  cursor?: string | null;
  limite: number;
}) {
  const busca = args.busca?.trim();
  const conversas = await prisma.conversation.findMany({
    where: {
      organizationId: args.organizationId,
      isGroup: false,
      ...(args.cursor ? { lastMessageAt: { lt: new Date(args.cursor) } } : {}),
      AND: [
        filtroDeConversa(args.vendedor),
        busca
          ? {
              lead: {
                OR: [
                  { name: { contains: busca, mode: "insensitive" as const } },
                  { phone: { contains: busca } },
                ],
              },
            }
          : {},
      ],
    },
    orderBy: { lastMessageAt: "desc" },
    take: args.limite,
    select: {
      id: true,
      lastMessageAt: true,
      lead: {
        select: {
          id: true,
          name: true,
          phone: true,
          customer: { select: { id: true, name: true, tradeName: true } },
        },
      },
      lastMessage: { select: { body: true, mediaType: true, fromMe: true } },
      _count: {
        select: { messages: { where: { seen: false, fromMe: false } } },
      },
    },
  });
  const ultima = conversas.at(-1);
  return {
    conversas: conversas.map((conversa) => ({
      id: conversa.id,
      nome:
        conversa.lead.customer?.tradeName ||
        conversa.lead.customer?.name ||
        conversa.lead.name,
      telefone: conversa.lead.phone,
      customerId: conversa.lead.customer?.id ?? null,
      naoLidas: conversa._count.messages,
      ultimaEm: conversa.lastMessageAt.toISOString(),
      previa: conversa.lastMessage
        ? {
            corpo: conversa.lastMessage.body,
            tipoDeMidia: conversa.lastMessage.mediaType,
            fromMe: conversa.lastMessage.fromMe,
          }
        : null,
    })),
    proximoCursor:
      conversas.length === args.limite && ultima
        ? ultima.lastMessageAt.toISOString()
        : null,
  };
}

export async function naoLidasDaCarteira(args: {
  organizationId: string;
  vendedor: ContextoVendedor;
}): Promise<number> {
  return prisma.message.count({
    where: {
      seen: false,
      fromMe: false,
      conversation: {
        organizationId: args.organizationId,
        ...filtroDeConversa(args.vendedor),
      },
    },
  });
}

/** A conversa é do vendedor? Usado antes de abrir o histórico no módulo. */
export async function exigirConversaDoVendedor(args: {
  organizationId: string;
  vendedor: ContextoVendedor;
  conversationId: string;
}) {
  const conversa = await prisma.conversation.findFirst({
    where: {
      id: args.conversationId,
      organizationId: args.organizationId,
      ...filtroDeConversa(args.vendedor),
    },
    select: {
      id: true,
      lead: {
        select: {
          name: true,
          phone: true,
          customer: { select: { id: true, name: true, tradeName: true } },
        },
      },
    },
  });
  if (!conversa) {
    throw new ORPCError("NOT_FOUND", { message: "Conversa não encontrada" });
  }
  return {
    id: conversa.id,
    nome:
      conversa.lead.customer?.tradeName ||
      conversa.lead.customer?.name ||
      conversa.lead.name,
    telefone: conversa.lead.phone,
    customerId: conversa.lead.customer?.id ?? null,
  };
}

/** Conversa do cliente (para o botão "Conversar" da ficha), se existir. */
export async function conversaDoCliente(args: {
  organizationId: string;
  vendedor: ContextoVendedor;
  customerId: string;
}) {
  const conversa = await prisma.conversation.findFirst({
    where: {
      organizationId: args.organizationId,
      lead: { customerId: args.customerId },
      ...filtroDeConversa(args.vendedor),
    },
    orderBy: { lastMessageAt: "desc" },
    select: { id: true },
  });
  return conversa?.id ?? null;
}
