import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";
import { resolveCalendarActor } from "./_access";
import { noteInputSchema } from "./_schemas";

// Anotações privadas. Não exigem `canManage` — qualquer membro tem a sua — mas
// TODA consulta trava em `memberId`, nunca só no id. Nem o owner lê a nota
// alheia; é a promessa que faz o promotor usar a agenda.

export const createCalendarNote = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(noteInputSchema)
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const actor = await resolveCalendarActor(context.org.id, context.user.id);
    if (!actor) {
      throw errors.FORBIDDEN({
        message: "Você não é membro desta organização",
      });
    }

    const note = await prisma.calendarNote.create({
      data: {
        organizationId: context.org.id,
        memberId: actor.memberId,
        title: input.title,
        content: input.content ?? null,
        color: input.color ?? null,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        isAllDay: input.isAllDay,
        tasks: {
          create: input.tasks.map((task, index) => ({
            organizationId: context.org.id,
            title: task.title,
            isDone: task.isDone,
            position: index,
          })),
        },
      },
      select: { id: true },
    });

    return { id: note.id };
  });

export const updateCalendarNote = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(noteInputSchema.extend({ id: z.string() }))
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const actor = await resolveCalendarActor(context.org.id, context.user.id);
    if (!actor) {
      throw errors.FORBIDDEN({
        message: "Você não é membro desta organização",
      });
    }

    // `updateMany` com memberId no where: é ele que garante que ninguém edita
    // a anotação de outra pessoa, mesmo com o id em mãos.
    const { count } = await prisma.calendarNote.updateMany({
      where: {
        id: input.id,
        organizationId: context.org.id,
        memberId: actor.memberId,
      },
      data: {
        title: input.title,
        content: input.content ?? null,
        color: input.color ?? null,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        isAllDay: input.isAllDay,
      },
    });
    if (count === 0)
      throw errors.NOT_FOUND({ message: "Anotação não encontrada" });

    // Só depois de confirmar a posse acima é que os itens são tocados.
    const keptIds = input.tasks
      .map((task) => task.id)
      .filter((id): id is string => Boolean(id));

    await prisma.$transaction([
      prisma.calendarNoteTask.deleteMany({
        where: {
          noteId: input.id,
          ...(keptIds.length > 0 ? { id: { notIn: keptIds } } : {}),
        },
      }),
      ...input.tasks.map((task, index) =>
        task.id
          ? prisma.calendarNoteTask.update({
              where: { id: task.id },
              data: { title: task.title, isDone: task.isDone, position: index },
            })
          : prisma.calendarNoteTask.create({
              data: {
                organizationId: context.org.id,
                noteId: input.id,
                title: task.title,
                isDone: task.isDone,
                position: index,
              },
            }),
      ),
    ]);

    return { id: input.id };
  });

export const deleteCalendarNote = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const actor = await resolveCalendarActor(context.org.id, context.user.id);
    if (!actor) {
      throw errors.FORBIDDEN({
        message: "Você não é membro desta organização",
      });
    }

    const { count } = await prisma.calendarNote.deleteMany({
      where: {
        id: input.id,
        organizationId: context.org.id,
        memberId: actor.memberId,
      },
    });
    if (count === 0)
      throw errors.NOT_FOUND({ message: "Anotação não encontrada" });

    return { id: input.id };
  });
