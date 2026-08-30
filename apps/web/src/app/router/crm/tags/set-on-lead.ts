import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";

/**
 * Grava a lista inteira de etiquetas de um contato.
 *
 * Substituir tudo casa com o seletor de múltipla escolha da tela, e evita o
 * par attach/detach — que, com dois atendentes mexendo no mesmo card, deixa o
 * estado dependendo da ordem em que os cliques chegaram.
 *
 * Cada id vem do cliente e é confrontado com a organização antes de virar
 * vínculo: sem isso um id chutado penduraria etiqueta de outro tenant.
 */
export const setTagsOnLead = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Etiqueta um contato", tags: ["CRM"] })
  .input(
    z.object({
      leadId: z.string().min(1),
      tagIds: z.array(z.string().min(1)).max(20),
    }),
  )
  .output(z.object({ etiquetas: z.number() }))
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.org.id;

    const lead = await prisma.crmLead.findFirst({
      where: { id: input.leadId, organizationId },
      select: { id: true, funnelId: true },
    });
    if (!lead) throw errors.NOT_FOUND({ message: "Contato não encontrado" });

    const validas = await prisma.crmTag.findMany({
      where: {
        id: { in: input.tagIds },
        organizationId,
        archivedAt: null,
        OR: [{ funnelId: null }, { funnelId: lead.funnelId }],
      },
      select: { id: true },
    });

    if (validas.length !== input.tagIds.length) {
      throw errors.BAD_REQUEST({
        message: "Alguma etiqueta não existe mais ou não vale neste funil.",
      });
    }

    const anteriores = await prisma.crmLeadTag.findMany({
      where: { leadId: lead.id },
      select: { tagId: true },
    });
    const antes = new Set(anteriores.map((item) => item.tagId));
    const depois = new Set(validas.map((item) => item.id));

    const adicionadas = [...depois].filter((id) => !antes.has(id));
    const removidas = [...antes].filter((id) => !depois.has(id));

    if (adicionadas.length === 0 && removidas.length === 0) {
      return { etiquetas: depois.size };
    }

    await prisma.$transaction(async (tx) => {
      if (removidas.length > 0) {
        await tx.crmLeadTag.deleteMany({
          where: { leadId: lead.id, tagId: { in: removidas } },
        });
      }
      if (adicionadas.length > 0) {
        await tx.crmLeadTag.createMany({
          data: adicionadas.map((tagId) => ({ leadId: lead.id, tagId })),
          skipDuplicates: true,
        });
      }

      // Uma linha por mudança, não uma por gravação: o histórico responde
      // "quando esta etiqueta entrou", e um registro de "salvou" não responde.
      await tx.crmLeadHistory.createMany({
        data: [
          ...adicionadas.map((tagId) => ({
            organizationId,
            leadId: lead.id,
            action: "ACTIVE" as const,
            eventType: "TAG_ADDED" as const,
            metadata: { tagId },
            userId: context.user.id,
          })),
          ...removidas.map((tagId) => ({
            organizationId,
            leadId: lead.id,
            action: "ACTIVE" as const,
            eventType: "TAG_REMOVED" as const,
            metadata: { tagId },
            userId: context.user.id,
          })),
        ],
      });
    });

    return { etiquetas: depois.size };
  });
