import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Remove uma página inteira do book (fotos ou extra). Os BookItems da página
// somem em cascata (onDelete). Serve principalmente pras páginas extras, que
// não têm itens e por isso não podiam ser removidas pela cascata de item.
export const deleteBookPage = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ bookId: z.string(), pageId: z.string() }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const page = await prisma.bookPage.findFirst({
      where: {
        id: input.pageId,
        bookId: input.bookId,
        book: { organizationId: context.org.id },
      },
      select: { id: true },
    });
    if (!page) {
      throw errors.NOT_FOUND({ message: "Página não encontrada" });
    }

    await prisma.bookPage.delete({ where: { id: page.id } });

    return { ok: true };
  });
