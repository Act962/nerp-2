import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { orientationFromAspect } from "@/features/books/server/distribute-photos";
import { z } from "zod";

export const removeBookItem = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z
      .object({
        bookId: z.string(),
        // `itemId` é o modo preferido (novo modelo com N itens por página).
        // `pdvPhotoId` fica pra compatibilidade com books antigos que ainda
        // têm 1 item por página; se ambos vierem, itemId ganha.
        itemId: z.string().optional(),
        pdvPhotoId: z.string().optional(),
      })
      .refine((v) => v.itemId || v.pdvPhotoId, {
        message: "Informe itemId ou pdvPhotoId",
      }),
  )
  .handler(async ({ input, context, errors }) => {
    const book = await prisma.book.findFirst({
      where: { id: input.bookId, organizationId: context.org.id },
      select: { id: true, organizationId: true, supplierId: true },
    });
    if (!book) {
      throw errors.NOT_FOUND({ message: "Book não encontrado" });
    }

    // Padrões PHOTO da indústria, indexados por "ORIENTATION-size" — pra
    // reaplicar o padrão da nova contagem quando uma página perde uma foto.
    const photoTemplates = book.supplierId
      ? await prisma.bookPageTemplate.findMany({
          where: {
            organizationId: book.organizationId,
            supplierId: book.supplierId,
            kind: "PHOTO",
          },
          select: {
            photoOrientation: true,
            photoSize: true,
            layout: true,
            background: true,
          },
        })
      : [];
    const templateFor = (orientation: string, size: number) =>
      photoTemplates.find(
        (t) => t.photoOrientation === orientation && t.photoSize === size,
      ) ?? null;

    // Coleta as páginas afetadas antes de apagar — precisamos delas pra saber
    // se ficaram vazias (nesse caso a BookPage também vai).
    const items = await prisma.bookItem.findMany({
      where: input.itemId
        ? { id: input.itemId, bookId: input.bookId }
        : { bookId: input.bookId, pdvPhotoId: input.pdvPhotoId },
      select: { id: true, bookPageId: true },
    });

    if (items.length === 0) return { success: true };

    const affectedPages = new Set(
      items.map((i) => i.bookPageId).filter((v): v is string => Boolean(v)),
    );

    await prisma.$transaction(async (tx) => {
      await tx.bookItem.deleteMany({
        where: { id: { in: items.map((i) => i.id) } },
      });

      for (const pageId of affectedPages) {
        // Se a página ficou vazia, apaga junto. Caso contrário, renumera
        // slotIndex 0..n-1 pra ficar contíguo (evita "buracos" no renderer).
        const remaining = await tx.bookItem.findMany({
          where: { bookPageId: pageId },
          orderBy: [{ slotIndex: "asc" }, { order: "asc" }],
          select: { id: true, pdvPhoto: { select: { photoAspect: true } } },
        });
        if (remaining.length === 0) {
          await tx.bookPage.delete({ where: { id: pageId } });
          continue;
        }
        for (let i = 0; i < remaining.length; i++) {
          await tx.bookItem.update({
            where: { id: remaining[i].id },
            data: { slotIndex: i },
          });
        }

        // Adota o padrão da indústria pra nova contagem: 4→3, 3→2, 2→1. A
        // orientação vem da 1ª foto restante (a página não mistura orientações).
        const orientation = orientationFromAspect(
          remaining[0]?.pdvPhoto.photoAspect ?? null,
        );
        const template = templateFor(orientation, remaining.length);
        if (template) {
          await tx.bookPage.update({
            where: { id: pageId },
            data: {
              pageLayout: template.layout ?? Prisma.DbNull,
              pageBackground: template.background ?? Prisma.DbNull,
            },
          });
        }
      }
    });

    return { success: true };
  });
