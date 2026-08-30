import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";

/**
 * Encerra o contato como ganho ou perdido, com motivo.
 *
 * O motivo é o que transforma "perdemos 30 este mês" em "perdemos 30, sendo 18
 * por preço" — e é por isso que ele é gravado no histórico, não num campo do
 * lead: um contato pode ser reaberto e perdido de novo por outro motivo, e as
 * duas passagens interessam.
 *
 * `reabrir` desfaz: volta o lead para ativo sem apagar nada do que ficou
 * registrado.
 */
export const closeLead = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Ganha/perde um contato", tags: ["CRM"] })
  .input(
    z.object({
      leadId: z.string().min(1),
      resultado: z.enum(["WON", "LOST", "REABRIR"]),
      reasonId: z.string().optional(),
      observacao: z.string().trim().max(500).optional(),
    }),
  )
  .output(z.object({ id: z.string(), resultado: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.org.id;

    const lead = await prisma.crmLead.findFirst({
      where: { id: input.leadId, organizationId },
      select: { id: true, funnelId: true },
    });
    if (!lead) throw errors.NOT_FOUND({ message: "Contato não encontrado" });

    if (input.reasonId) {
      const motivo = await prisma.crmWinLossReason.findFirst({
        where: {
          id: input.reasonId,
          organizationId,
          funnelId: lead.funnelId,
        },
        select: { id: true, type: true },
      });
      if (!motivo) {
        throw errors.NOT_FOUND({
          message: "Motivo não encontrado neste funil",
        });
      }
      // Motivo de perda num ganho (ou o contrário) entra no relatório do lado
      // errado e ninguém percebe.
      const esperado = input.resultado === "WON" ? "WIN" : "LOSS";
      if (input.resultado !== "REABRIR" && motivo.type !== esperado) {
        throw errors.BAD_REQUEST({
          message: "Esse motivo é do outro resultado.",
        });
      }
    }

    const acao = input.resultado === "REABRIR" ? "ACTIVE" : input.resultado;
    const agora = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.crmLead.update({
        where: { id: lead.id },
        data: {
          currentAction: acao,
          statusFlow: acao === "ACTIVE" ? "ACTIVE" : "FINISHED",
          lastStatusChangeAt: agora,
        },
      });

      await tx.crmLeadHistory.create({
        data: {
          organizationId,
          leadId: lead.id,
          action: acao,
          eventType: "ACTION_CHANGE",
          reasonId: input.reasonId ?? null,
          notes: input.observacao || null,
          userId: context.user.id,
        },
      });
    });

    return { id: lead.id, resultado: acao };
  });
