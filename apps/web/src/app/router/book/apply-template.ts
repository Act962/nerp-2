import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { z } from "zod";

// Copia um padrão salvo para dentro do book. Cópia por valor: editar o padrão
// depois não altera books já montados, e vice-versa.
export const applyBookTemplate = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ bookId: z.string(), templateId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const [book, template] = await Promise.all([
      prisma.book.findFirst({
        where: { id: input.bookId, organizationId: context.org.id },
        select: { id: true },
      }),
      prisma.bookTemplate.findFirst({
        where: { id: input.templateId, organizationId: context.org.id },
      }),
    ]);

    if (!book) throw errors.NOT_FOUND({ message: "Book não encontrado" });
    if (!template) throw errors.NOT_FOUND({ message: "Padrão não encontrado" });

    await prisma.book.update({
      where: { id: book.id },
      data: {
        coverLayout: template.coverLayout ?? Prisma.DbNull,
        closingLayout: template.closingLayout ?? Prisma.DbNull,
        pageLayout: template.pageLayout ?? Prisma.DbNull,
        coverBackground: template.coverBackground ?? Prisma.DbNull,
        closingBackground: template.closingBackground ?? Prisma.DbNull,
        pageBackground: template.pageBackground ?? Prisma.DbNull,
      },
    });

    return { success: true as const };
  });
