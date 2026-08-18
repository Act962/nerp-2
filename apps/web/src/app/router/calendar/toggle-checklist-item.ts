import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";
import { assertEventVisible, resolveCalendarActor } from "./_access";

/**
 * Marca/desmarca um item do checklist para o membro logado, opcionalmente numa
 * loja específica.
 *
 * É a procedure mais sensível do módulo. "É membro da org, então pode marcar"
 * está ERRADO: qualquer promotor marcaria item de evento que nem enxerga. A
 * autorização é a mesma da leitura — se o evento não aparece para ele, ele não
 * escreve nele.
 */
export const toggleChecklistItem = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      itemId: z.string(),
      storeId: z.string().nullable().default(null),
      done: z.boolean(),
      note: z.string().trim().max(500).nullable().optional(),
    }),
  )
  .output(
    z.object({
      itemId: z.string(),
      storeId: z.string().nullable(),
      done: z.boolean(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const actor = await resolveCalendarActor(context.org.id, context.user.id);
    if (!actor) {
      throw errors.FORBIDDEN({
        message: "Você não é membro desta organização",
      });
    }

    const item = await prisma.calendarChecklistItem.findFirst({
      where: { id: input.itemId, organizationId: context.org.id },
      select: { id: true, eventId: true },
    });
    if (!item) throw errors.NOT_FOUND({ message: "Item não encontrado" });

    const visible = await assertEventVisible({
      organizationId: context.org.id,
      actor,
      eventId: item.eventId,
    });
    if (!visible) {
      throw errors.FORBIDDEN({
        message: "Você não tem acesso a este evento",
      });
    }

    if (input.storeId) {
      // A loja precisa ser alvo DO EVENTO...
      const target = await prisma.calendarEventStore.findFirst({
        where: {
          eventId: item.eventId,
          storeId: input.storeId,
          organizationId: context.org.id,
        },
        select: { id: true },
      });
      if (!target) {
        throw errors.BAD_REQUEST({
          message: "Esta loja não faz parte do evento",
        });
      }

      // ...e, para quem não gerencia, precisa ser uma loja dele. Senão um
      // promotor marcaria a execução na loja de outro.
      if (!actor.canManage) {
        const link = await prisma.promoterStore.findFirst({
          where: {
            organizationId: context.org.id,
            memberId: actor.memberId,
            storeId: input.storeId,
          },
          select: { id: true },
        });
        if (!link) {
          throw errors.FORBIDDEN({
            message: "Você não atende esta loja",
          });
        }
      }
    }

    // deleteMany + create em vez de upsert: o `@@unique` com `storeId` nulo não
    // funciona no Postgres (NULL é distinto de NULL), e o upsert do Prisma nem
    // aceita a chave composta com campo nulo. O índice parcial da migração
    // garante a unicidade nesse caso.
    await prisma.calendarChecklistCompletion.deleteMany({
      where: {
        itemId: item.id,
        memberId: actor.memberId,
        storeId: input.storeId,
      },
    });

    if (input.done) {
      await prisma.calendarChecklistCompletion.create({
        data: {
          organizationId: context.org.id,
          itemId: item.id,
          memberId: actor.memberId,
          storeId: input.storeId,
          note: input.note ?? null,
        },
      });
    }

    return { itemId: item.id, storeId: input.storeId, done: input.done };
  });
