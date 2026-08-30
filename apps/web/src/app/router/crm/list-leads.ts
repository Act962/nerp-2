import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { requireFunnelDaOrg } from "./_access";

/**
 * Cards do board, agrupados por etapa.
 *
 * Devolve tudo de uma vez, sem paginar por coluna: o board precisa das colunas
 * completas para arrastar entre elas, e paginar por coluna faria o card sumir
 * ao ser solto numa coluna cuja página ainda não carregou. O teto de
 * `porEtapa` existe para uma etapa com dez mil cards não derrubar a tela — o
 * total real vai em `totalDeLeads` para a coluna dizer quantos ficaram de fora.
 */
export const listLeads = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "Cards do funil por etapa", tags: ["CRM"] })
  .input(
    z.object({
      funnelId: z.string().min(1),
      busca: z.string().trim().optional(),
      responsavelId: z.string().optional(),
      temperatura: z.enum(["COLD", "WARM", "HOT", "VERY_HOT"]).optional(),
      porEtapa: z.number().int().min(1).max(200).default(50),
    }),
  )
  .output(
    z.object({
      colunas: z.array(
        z.object({
          id: z.string(),
          nome: z.string(),
          cor: z.string().nullable(),
          totalDeLeads: z.number(),
          valorTotal: z.number(),
          cards: z.array(
            z.object({
              id: z.string(),
              nome: z.string(),
              telefone: z.string().nullable(),
              valor: z.number(),
              temperatura: z.enum(["COLD", "WARM", "HOT", "VERY_HOT"]),
              statusFlow: z.enum(["NEW", "ACTIVE", "WAITING", "FINISHED"]),
              ordem: z.number(),
              temCliente: z.boolean(),
              responsavel: z.string().nullable(),
              conversationId: z.string().nullable(),
              naoLidas: z.number(),
              tags: z.array(
                z.object({
                  id: z.string(),
                  nome: z.string(),
                  cor: z.string().nullable(),
                }),
              ),
            }),
          ),
        }),
      ),
    }),
  )
  .handler(async ({ input, context }) => {
    const organizationId = context.org.id;
    await requireFunnelDaOrg(input.funnelId, organizationId);

    const busca = input.busca?.trim();
    const filtroDeLead = {
      organizationId,
      funnelId: input.funnelId,
      isArchived: false,
      ...(input.responsavelId ? { responsibleId: input.responsavelId } : {}),
      ...(input.temperatura ? { temperature: input.temperatura } : {}),
      ...(busca
        ? {
            OR: [
              { name: { contains: busca, mode: "insensitive" as const } },
              { phone: { contains: busca } },
            ],
          }
        : {}),
    };

    const etapas = await prisma.crmStage.findMany({
      where: { funnelId: input.funnelId, organizationId },
      orderBy: { order: "asc" },
      select: { id: true, name: true, color: true },
    });

    // Uma consulta por etapa e não uma só com `include`: o `take` precisa valer
    // por coluna, e `include` com `take` limitaria o total, não cada uma.
    const colunas = await Promise.all(
      etapas.map(async (etapa) => {
        const [cards, total, soma] = await Promise.all([
          prisma.crmLead.findMany({
            where: { ...filtroDeLead, stageId: etapa.id },
            orderBy: { order: "asc" },
            take: input.porEtapa,
            select: {
              id: true,
              name: true,
              phone: true,
              amount: true,
              temperature: true,
              statusFlow: true,
              order: true,
              customerId: true,
              responsible: { select: { name: true } },
              conversation: {
                select: {
                  id: true,
                  _count: {
                    select: {
                      messages: { where: { seen: false, fromMe: false } },
                    },
                  },
                },
              },
              leadTags: {
                select: {
                  tag: { select: { id: true, name: true, color: true } },
                },
              },
            },
          }),
          prisma.crmLead.count({
            where: { ...filtroDeLead, stageId: etapa.id },
          }),
          prisma.crmLead.aggregate({
            where: { ...filtroDeLead, stageId: etapa.id },
            _sum: { amount: true },
          }),
        ]);

        return {
          id: etapa.id,
          nome: etapa.name,
          cor: etapa.color,
          totalDeLeads: total,
          valorTotal: Number(soma._sum.amount ?? 0),
          cards: cards.map((card) => ({
            id: card.id,
            nome: card.name,
            telefone: card.phone,
            valor: Number(card.amount),
            temperatura: card.temperature,
            statusFlow: card.statusFlow,
            ordem: Number(card.order),
            temCliente: card.customerId !== null,
            responsavel: card.responsible?.name ?? null,
            conversationId: card.conversation?.id ?? null,
            naoLidas: card.conversation?._count.messages ?? 0,
            tags: card.leadTags.map((vinculo) => ({
              id: vinculo.tag.id,
              nome: vinculo.tag.name,
              cor: vinculo.tag.color,
            })),
          })),
        };
      }),
    );

    return { colunas };
  });
