import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { z } from "zod";

// Duplica uma página do book: copia o PdvPhoto de origem (dados + fotos +
// enquadramentos) para um novo, independente, e cria um BookItem novo com o
// mesmo layout próprio. A cópia nasce PENDING (aprovação não é herdada).
export const duplicateBookPage = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ bookId: z.string(), itemId: z.string() }))
  .output(z.object({ pdvPhotoId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const item = await prisma.bookItem.findFirst({
      where: {
        id: input.itemId,
        bookId: input.bookId,
        book: { organizationId: context.org.id },
      },
      include: { pdvPhoto: true },
    });
    if (!item) throw errors.NOT_FOUND({ message: "Página não encontrada" });

    const source = item.pdvPhoto;

    const pdvPhotoId = await prisma.$transaction(async (tx) => {
      const photo = await tx.pdvPhoto.create({
        data: {
          organizationId: context.org.id,
          storeId: source.storeId,
          mapObjectId: source.mapObjectId,
          supplierId: source.supplierId,
          mediaTypeId: source.mediaTypeId,
          section: source.section,
          responsibleCompany: source.responsibleCompany,
          managerName: source.managerName,
          coordinatorName: source.coordinatorName,
          consultantName: source.consultantName,
          code: source.code,
          actionValue: source.actionValue,
          photos: source.photos,
          photoLayout: source.photoLayout,
          photoAdjustments: source.photoAdjustments ?? Prisma.DbNull,
          notes: source.notes,
          createdById: context.user.id,
        },
        select: { id: true },
      });

      const last = await tx.bookItem.findFirst({
        where: { bookId: input.bookId },
        orderBy: { order: "desc" },
        select: { order: true },
      });

      await tx.bookItem.create({
        data: {
          bookId: input.bookId,
          pdvPhotoId: photo.id,
          order: (last?.order ?? -1) + 1,
          pageLayout: item.pageLayout ?? Prisma.DbNull,
          pageBackground: item.pageBackground ?? Prisma.DbNull,
        },
      });

      return photo.id;
    });

    return { pdvPhotoId };
  });
