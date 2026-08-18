import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { z } from "zod";

// Salva o layout de página atual como padrão reaplicável. Sem `itemId`, copia
// o layout do book (o que a aba Personalizado edita); com `itemId`, copia o
// layout próprio daquela página, caindo no do book se ela não tiver um.
export const saveBookPageTemplate = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      bookId: z.string(),
      itemId: z.string().nullable().optional(),
      name: z.string().min(1, "Dê um nome ao padrão").max(80),
      supplierId: z.string().nullable(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const book = await prisma.book.findFirst({
      where: { id: input.bookId, organizationId: context.org.id },
      select: { id: true, pageLayout: true, pageBackground: true },
    });
    if (!book) throw errors.NOT_FOUND({ message: "Book não encontrado" });

    let layout = book.pageLayout;
    let background = book.pageBackground;

    if (input.itemId) {
      const item = await prisma.bookItem.findFirst({
        where: { id: input.itemId, bookId: book.id },
        select: { pageLayout: true, pageBackground: true },
      });
      if (!item) throw errors.NOT_FOUND({ message: "Página não encontrada" });
      layout = item.pageLayout ?? layout;
      background = item.pageBackground ?? background;
    }

    if (!layout) {
      throw errors.BAD_REQUEST({
        message: "Monte o layout da página antes de salvar o padrão",
      });
    }

    if (input.supplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: { id: input.supplierId, organizationId: context.org.id },
        select: { id: true },
      });
      if (!supplier) {
        throw errors.NOT_FOUND({ message: "Indústria não encontrada" });
      }
    }

    const data = { layout, background: background ?? Prisma.DbNull };

    // Sem upsert: o Postgres trata cada NULL como distinto na unique composta,
    // então (org, NULL, nome) nunca casaria e todo save de padrão da
    // organização criaria uma duplicata.
    const existing = await prisma.bookPageTemplate.findFirst({
      where: {
        organizationId: context.org.id,
        supplierId: input.supplierId,
        name: input.name,
      },
      select: { id: true },
    });

    if (existing) {
      return prisma.bookPageTemplate.update({
        where: { id: existing.id },
        data,
        select: { id: true, name: true },
      });
    }

    return prisma.bookPageTemplate.create({
      data: {
        organizationId: context.org.id,
        supplierId: input.supplierId,
        name: input.name,
        createdById: context.user.id,
        ...data,
      },
      select: { id: true, name: true },
    });
  });
