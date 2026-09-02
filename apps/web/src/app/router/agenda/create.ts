import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireFunnelDaOrg } from "@/app/router/crm/_access";
import prisma from "@/lib/db";
import { comoSlug } from "./_access";

/**
 * Grade que toda agenda nova já nasce tendo: manhã e tarde, de segunda a
 * sexta.
 *
 * Agenda sem grade não oferece horário nenhum, e o link público criado nesse
 * estado mostra um calendário vazio — a pior primeira impressão possível para
 * quem acabou de mandar o link para um cliente.
 */
const GRADE_PADRAO = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
] as const;

const FAIXAS_PADRAO = [
  { startTime: "08:00", endTime: "12:00", order: 0 },
  { startTime: "14:00", endTime: "18:00", order: 1 },
];

export const createAgenda = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Cria uma agenda", tags: ["Agenda"] })
  .input(
    z.object({
      name: z.string().trim().min(1, "Informe o nome da agenda"),
      funnelId: z.string().min(1, "Escolha o funil"),
      description: z.string().trim().optional(),
      slotDuration: z.number().int().min(5).max(480).default(30),
    }),
  )
  .output(z.object({ id: z.string(), slug: z.string() }))
  .handler(async ({ input, context }) => {
    const organizationId = context.org.id;
    await requireFunnelDaOrg(input.funnelId, organizationId);

    const slug = await slugLivre(
      comoSlug(input.name) || "agenda",
      organizationId,
    );

    return prisma.$transaction(async (tx) => {
      const agenda = await tx.agenda.create({
        data: {
          organizationId,
          funnelId: input.funnelId,
          name: input.name,
          description: input.description || null,
          slug,
          slotDuration: input.slotDuration,
        },
        select: { id: true, slug: true },
      });

      for (const dia of GRADE_PADRAO) {
        await tx.agendaAvailability.create({
          data: {
            agendaId: agenda.id,
            dayOfWeek: dia,
            timeSlots: { create: FAIXAS_PADRAO },
          },
        });
      }

      // Quem cria é o primeiro responsável — agenda sem responsável não tem
      // para quem tocar o compromisso.
      await tx.agendaResponsible.create({
        data: { agendaId: agenda.id, userId: context.user.id },
      });

      return agenda;
    });
  });

/** `atendimento`, `atendimento-2`, `atendimento-3`… O slug é da URL pública. */
async function slugLivre(
  desejado: string,
  organizationId: string,
): Promise<string> {
  for (let tentativa = 0; tentativa < 50; tentativa++) {
    const slug = tentativa === 0 ? desejado : `${desejado}-${tentativa + 1}`;
    const usado = await prisma.agenda.findUnique({
      where: { slug_organizationId: { slug, organizationId } },
      select: { id: true },
    });
    if (!usado) return slug;
  }
  return `${desejado}-${Date.now()}`;
}
