import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Devolve o book à herança: a capa e a página final voltam a sair do padrão
// COVER/CLOSING da indústria. É o caminho de volta de `customChrome`, que liga
// sozinho na primeira edição feita dentro do book — sem ele, editar a capa uma
// vez seria porta de mão única.
//
// O layout editado continua gravado no book: ele volta a valer se a indústria
// perder o padrão, e nova edição sobrescreve mesmo.
export const resetBookChrome = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const book = await prisma.book.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!book) {
      throw errors.NOT_FOUND({ message: "Book não encontrado" });
    }

    return prisma.book.update({
      where: { id: input.id },
      data: { customChrome: false },
      select: { id: true },
    });
  });
