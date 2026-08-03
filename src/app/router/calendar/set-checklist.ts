import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";
import { resolveCalendarActor } from "./_access";

// Define o roteiro do evento. Substitui a lista inteira: itens ausentes do
// payload são apagados, e com eles as conclusões (cascade) — é o comportamento
// certo, porque um item removido do roteiro não deve continuar cobrando ninguém.
export const setCalendarChecklist = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      eventId: z.string(),
      items: z
        .array(
          z.object({
            id: z.string().optional(),
            title: z.string().trim().min(1, "Informe o item").max(140),
            description: z.string().trim().max(500).nullable().optional(),
            isRequired: z.boolean().default(true),
          }),
        )
        .max(50),
    }),
  )
  .output(z.object({ eventId: z.string(), count: z.number() }))
  .handler(async ({ input, context, errors }) => {
    const actor = await resolveCalendarActor(context.org.id, context.user.id);
    if (!actor?.canManage) {
      throw errors.FORBIDDEN({
        message: "Você não pode editar o checklist",
      });
    }

    const event = await prisma.calendarEvent.findFirst({
      where: { id: input.eventId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!event) throw errors.NOT_FOUND({ message: "Evento não encontrado" });

    const keptIds = input.items
      .map((item) => item.id)
      .filter((id): id is string => Boolean(id));

    await prisma.$transaction([
      // Some com o que saiu do roteiro...
      prisma.calendarChecklistItem.deleteMany({
        where: {
          eventId: event.id,
          ...(keptIds.length > 0 ? { id: { notIn: keptIds } } : {}),
        },
      }),
      // ...e regrava os que ficaram, na ordem em que chegaram.
      ...input.items.map((item, index) =>
        item.id
          ? prisma.calendarChecklistItem.update({
              where: { id: item.id },
              data: {
                title: item.title,
                description: item.description ?? null,
                isRequired: item.isRequired,
                position: index,
              },
            })
          : prisma.calendarChecklistItem.create({
              data: {
                organizationId: context.org.id,
                eventId: event.id,
                title: item.title,
                description: item.description ?? null,
                isRequired: item.isRequired,
                position: index,
              },
            }),
      ),
    ]);

    return { eventId: event.id, count: input.items.length };
  });
