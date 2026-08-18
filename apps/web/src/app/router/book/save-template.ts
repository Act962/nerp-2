import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { z } from "zod";

// Salva o visual atual do book como padrão reaplicável. Copia do book já
// persistido em vez de receber os layouts do cliente: o editor faz autosave,
// então o banco é a fonte de verdade e não há risco do padrão divergir do que
// o usuário vê na tela.
export const saveBookTemplate = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      bookId: z.string(),
      name: z.string().min(1, "Dê um nome ao padrão").max(80),
      // null salva como padrão da organização; preenchido, como padrão daquela
      // indústria. A cópia é por valor — depois disso os dois são independentes.
      supplierId: z.string().nullable(),
      isDefault: z.boolean().default(true),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const book = await prisma.book.findFirst({
      where: { id: input.bookId, organizationId: context.org.id },
      select: {
        coverLayout: true,
        closingLayout: true,
        pageLayout: true,
        coverBackground: true,
        closingBackground: true,
        pageBackground: true,
      },
    });
    if (!book) throw errors.NOT_FOUND({ message: "Book não encontrado" });

    if (!book.coverLayout || !book.closingLayout) {
      throw errors.BAD_REQUEST({
        message: "Monte a capa e a página final antes de salvar o padrão",
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

    const layoutData = {
      coverLayout: book.coverLayout,
      closingLayout: book.closingLayout,
      pageLayout: book.pageLayout ?? Prisma.DbNull,
      coverBackground: book.coverBackground ?? Prisma.DbNull,
      closingBackground: book.closingBackground ?? Prisma.DbNull,
      pageBackground: book.pageBackground ?? Prisma.DbNull,
      isDefault: input.isDefault,
    };

    return prisma.$transaction(async (tx) => {
      // Um padrão default por indústria: promover um rebaixa os irmãos, senão
      // o editor teria dois candidatos e escolheria por ordem de listagem.
      if (input.isDefault) {
        await tx.bookTemplate.updateMany({
          where: {
            organizationId: context.org.id,
            supplierId: input.supplierId,
            name: { not: input.name },
          },
          data: { isDefault: false },
        });
      }

      // Não dá pra usar upsert na unique composta: o Postgres trata cada NULL
      // como distinto, então (org, NULL, nome) nunca casaria com a linha
      // existente e todo save de padrão da organização criaria uma duplicata.
      const existing = await tx.bookTemplate.findFirst({
        where: {
          organizationId: context.org.id,
          supplierId: input.supplierId,
          name: input.name,
        },
        select: { id: true },
      });

      if (existing) {
        return tx.bookTemplate.update({
          where: { id: existing.id },
          data: layoutData,
          select: { id: true, name: true },
        });
      }

      return tx.bookTemplate.create({
        data: {
          organizationId: context.org.id,
          supplierId: input.supplierId,
          name: input.name,
          createdById: context.user.id,
          ...layoutData,
        },
        select: { id: true, name: true },
      });
    });
  });
