import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { z } from "zod";
import { assertMediaTypeInOrg } from "../pdv-photo/assert-relations";

// Cria uma página em branco (PdvPhoto vazio) e já vincula ao book — o
// vendedor preenche os campos e sobe as fotos direto na página, sem
// precisar de um fluxo separado de "importar fotos" pré-existentes.
export const addBookPage = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      bookId: z.string(),
      storeId: z.string(),
      mediaTypeId: z.string().optional(),
      // Padrão de página opcional: a página já nasce com esse layout próprio,
      // em vez de seguir o layout do book.
      pageTemplateId: z.string().nullable().optional(),
    }),
  )
  .output(z.object({ pdvPhotoId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const book = await prisma.book.findFirst({
      where: { id: input.bookId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!book) {
      throw errors.NOT_FOUND({ message: "Book não encontrado" });
    }

    const store = await prisma.store.findFirst({
      where: { id: input.storeId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!store) {
      throw errors.NOT_FOUND({ message: "Loja não encontrada" });
    }

    if (input.mediaTypeId) {
      await assertMediaTypeInOrg(input.mediaTypeId, context.org.id, errors);
    }

    const pageTemplate = input.pageTemplateId
      ? await prisma.bookPageTemplate.findFirst({
          where: { id: input.pageTemplateId, organizationId: context.org.id },
          select: { layout: true, background: true },
        })
      : null;
    if (input.pageTemplateId && !pageTemplate) {
      throw errors.NOT_FOUND({ message: "Padrão de página não encontrado" });
    }

    const pdvPhotoId = await prisma.$transaction(async (tx) => {
      const photo = await tx.pdvPhoto.create({
        data: {
          organizationId: context.org.id,
          storeId: input.storeId,
          mediaTypeId: input.mediaTypeId,
          photos: [],
          createdById: context.user.id,
        },
        select: { id: true },
      });

      const [lastItem, lastPage] = await Promise.all([
        tx.bookItem.findFirst({
          where: { bookId: input.bookId },
          orderBy: { order: "desc" },
          select: { order: true },
        }),
        tx.bookPage.findFirst({
          where: { bookId: input.bookId },
          orderBy: { order: "desc" },
          select: { order: true },
        }),
      ]);

      // Cria a BookPage e um BookItem de slot 0. Layout do template (se veio)
      // fica na BookPage; o BookItem carrega só o vínculo com a foto.
      const page = await tx.bookPage.create({
        data: {
          bookId: input.bookId,
          storeId: input.storeId,
          order: (lastPage?.order ?? -1) + 1,
          ...(pageTemplate
            ? {
                pageLayout: pageTemplate.layout ?? Prisma.DbNull,
                pageBackground: pageTemplate.background ?? Prisma.DbNull,
              }
            : {}),
        },
        select: { id: true },
      });

      await tx.bookItem.create({
        data: {
          bookId: input.bookId,
          bookPageId: page.id,
          pdvPhotoId: photo.id,
          slotIndex: 0,
          order: (lastItem?.order ?? -1) + 1,
        },
      });

      return photo.id;
    });

    return { pdvPhotoId };
  });
