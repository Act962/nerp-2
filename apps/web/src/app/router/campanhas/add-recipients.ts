import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { recalcularContadores } from "@/features/campanhas/server/contadores";
import prisma from "@/lib/db";
import { requireCampanhaDaOrg } from "./_access";

/**
 * Monta a audiência a partir dos clientes do funil.
 *
 * Filtra por etapa, interesse e marcador — os mesmos recortes do board, para
 * quem monta a campanha não precisar aprender outro vocabulário.
 *
 * Só entra quem tem telefone: destinatário sem número seria uma linha
 * garantidamente falhada, poluindo o relatório da campanha com um erro que
 * nunca teve chance.
 */
export const addRecipientsFromLeads = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Adiciona clientes do funil à campanha",
    tags: ["Campanhas"],
  })
  .input(
    z.object({
      broadcastId: z.string().min(1),
      estagioIds: z.array(z.string()).optional(),
      temperatura: z.enum(["COLD", "WARM", "HOT", "VERY_HOT"]).optional(),
      tagIds: z.array(z.string()).optional(),
      /** Teto de segurança: campanha grande demais por engano custa dinheiro. */
      limite: z.number().int().min(1).max(5000).default(1000),
    }),
  )
  .output(
    z.object({
      adicionados: z.number(),
      jaEstavam: z.number(),
      semTelefone: z.number(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.org.id;
    const campanha = await requireCampanhaDaOrg(
      input.broadcastId,
      organizationId,
    );

    if (campanha.status !== "DRAFT" && campanha.status !== "SCHEDULED") {
      throw errors.BAD_REQUEST({
        message:
          "A audiência só pode mudar enquanto a campanha não começou a disparar.",
      });
    }

    const candidatos = await prisma.crmLead.findMany({
      where: {
        organizationId,
        funnelId: campanha.funnelId,
        isArchived: false,
        ...(input.estagioIds?.length
          ? { stageId: { in: input.estagioIds } }
          : {}),
        ...(input.temperatura ? { temperature: input.temperatura } : {}),
        ...(input.tagIds?.length
          ? { leadTags: { some: { tagId: { in: input.tagIds } } } }
          : {}),
      },
      select: { id: true, name: true, phone: true },
      take: input.limite,
    });

    const comTelefone = candidatos.filter((lead) => lead.phone);
    const semTelefone = candidatos.length - comTelefone.length;

    if (comTelefone.length === 0) {
      return { adicionados: 0, jaEstavam: 0, semTelefone };
    }

    // `skipDuplicates` resolve o mesmo número entrando duas vezes: a unique
    // (broadcastId, phone) existe justamente para ninguém receber em dobro.
    const { count } = await prisma.broadcastRecipient.createMany({
      data: comTelefone.map((lead) => ({
        broadcastId: campanha.id,
        leadId: lead.id,
        name: lead.name,
        phone: lead.phone as string,
      })),
      skipDuplicates: true,
    });

    await recalcularContadores(campanha.id);

    return {
      adicionados: count,
      jaEstavam: comTelefone.length - count,
      semTelefone,
    };
  });
