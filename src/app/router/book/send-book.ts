import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { memberCan } from "@/lib/permissions";
import { z } from "zod";

// Marca o book como enviado à indústria/fornecedor (libera a verba). Mesma
// permissão da aprovação — o contato costuma ser direto com a coordenadora.
// `undo: true` desfaz o envio.
export const sendBook = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string(), undo: z.boolean().optional() }))
  .handler(async ({ input, context, errors }) => {
    const member = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { role: true, permissions: true },
    });
    if (!memberCan(member, "books-aprovar")) {
      throw errors.FORBIDDEN({
        message: "Você não tem permissão para enviar o book",
      });
    }

    const book = await prisma.book.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!book) throw errors.NOT_FOUND({ message: "Book não encontrado" });

    await prisma.book.update({
      where: { id: book.id },
      data: input.undo
        ? { sentAt: null, sentById: null, sentByName: null }
        : {
            sentAt: new Date(),
            sentById: context.user.id,
            sentByName: context.user.name ?? null,
          },
    });

    return { success: true as const, sent: !input.undo };
  });
