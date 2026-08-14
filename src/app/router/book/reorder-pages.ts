import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Redefine a ordem das páginas do book (todas: fotos e extras). O client manda
// os ids na ordem desejada; gravamos order = índice. Capa/página final ficam
// fora — elas não são BookPages.
export const reorderBookPages = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      bookId: z.string(),
      orderedPageIds: z.array(z.string()).min(1),
    }),
  )
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const book = await prisma.book.findFirst({
      where: { id: input.bookId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!book) {
      throw errors.NOT_FOUND({ message: "Book não encontrado" });
    }

    // Todas as páginas do book precisam estar na lista (e nada de fora dela) —
    // impede reordenar página de outro book e mantém a ordem consistente.
    const pages = await prisma.bookPage.findMany({
      where: { bookId: book.id },
      select: { id: true },
    });
    const known = new Set(pages.map((p) => p.id));
    if (
      input.orderedPageIds.length !== pages.length ||
      input.orderedPageIds.some((id) => !known.has(id))
    ) {
      throw errors.BAD_REQUEST({
        message: "Lista de páginas inválida para este book.",
      });
    }

    await prisma.$transaction(
      input.orderedPageIds.map((id, index) =>
        prisma.bookPage.update({
          where: { id },
          data: { order: index },
        }),
      ),
    );

    return { ok: true };
  });
