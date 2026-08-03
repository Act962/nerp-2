import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";
import { resolveCalendarActor } from "./_access";

// Matriz "quem fez o quê" de um evento. Só gestão: é justamente a visão que o
// promotor não deve ter da execução dos colegas.
export const getChecklistProgress = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ eventId: z.string() }))
  .output(
    z.object({
      items: z.array(z.object({ id: z.string(), title: z.string() })),
      rows: z.array(
        z.object({
          memberId: z.string(),
          memberName: z.string(),
          storeId: z.string().nullable(),
          storeName: z.string().nullable(),
          doneItemIds: z.array(z.string()),
        }),
      ),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const actor = await resolveCalendarActor(context.org.id, context.user.id);
    if (!actor?.canManage) {
      throw errors.FORBIDDEN({
        message: "Você não pode ver o progresso da equipe",
      });
    }

    const event = await prisma.calendarEvent.findFirst({
      where: { id: input.eventId, organizationId: context.org.id },
      select: {
        id: true,
        checklistItems: {
          orderBy: { position: "asc" },
          select: { id: true, title: true },
        },
        assignees: {
          select: {
            member: { select: { id: true, user: { select: { name: true } } } },
          },
        },
      },
    });
    if (!event) throw errors.NOT_FOUND({ message: "Evento não encontrado" });

    const completions = await prisma.calendarChecklistCompletion.findMany({
      where: {
        organizationId: context.org.id,
        item: { eventId: event.id },
      },
      select: {
        itemId: true,
        memberId: true,
        storeId: true,
        member: { select: { user: { select: { name: true } } } },
        store: { select: { name: true } },
      },
    });

    // Agrupa por (promotor, loja): é essa dupla que identifica uma execução.
    const rows = new Map<
      string,
      {
        memberId: string;
        memberName: string;
        storeId: string | null;
        storeName: string | null;
        doneItemIds: string[];
      }
    >();

    // Escalados entram na matriz mesmo sem marcar nada: quem não fez é
    // exatamente a informação que a coordenação procura aqui.
    for (const link of event.assignees) {
      rows.set(`${link.member.id}::`, {
        memberId: link.member.id,
        memberName: link.member.user.name,
        storeId: null,
        storeName: null,
        doneItemIds: [],
      });
    }

    for (const done of completions) {
      const key = `${done.memberId}::${done.storeId ?? ""}`;
      const row = rows.get(key) ?? {
        memberId: done.memberId,
        memberName: done.member.user.name,
        storeId: done.storeId,
        storeName: done.store?.name ?? null,
        doneItemIds: [],
      };
      row.doneItemIds.push(done.itemId);
      rows.set(key, row);
    }

    return {
      items: event.checklistItems,
      rows: [...rows.values()].sort((a, b) =>
        a.memberName.localeCompare(b.memberName, "pt-BR"),
      ),
    };
  });
