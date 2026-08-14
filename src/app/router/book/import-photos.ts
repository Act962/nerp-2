import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const importBookPhotos = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      bookId: z.string(),
      pdvPhotoIds: z.array(z.string()),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const book = await prisma.book.findFirst({
      where: { id: input.bookId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!book) {
      throw errors.NOT_FOUND({ message: "Book não encontrado" });
    }

    // Só aceita fotos da própria organização.
    const validPhotos = await prisma.pdvPhoto.findMany({
      where: {
        id: { in: input.pdvPhotoIds },
        organizationId: context.org.id,
      },
      select: { id: true },
    });

    if (validPhotos.length === 0) return { added: 0 };

    // Cada foto importada vira 1 BookPage nova com 1 slot. Precisamos do
    // storeId de cada foto pra vincular a página à loja correta.
    const withStore = await prisma.pdvPhoto.findMany({
      where: {
        id: { in: validPhotos.map((p) => p.id) },
        organizationId: context.org.id,
      },
      select: { id: true, storeId: true },
    });
    const storeById = new Map(withStore.map((p) => [p.id, p.storeId]));

    const [lastItem, lastPage] = await Promise.all([
      prisma.bookItem.findFirst({
        where: { bookId: input.bookId },
        orderBy: { order: "desc" },
        select: { order: true },
      }),
      prisma.bookPage.findFirst({
        where: { bookId: input.bookId },
        orderBy: { order: "desc" },
        select: { order: true },
      }),
    ]);
    let itemOrder = (lastItem?.order ?? -1) + 1;
    let pageOrder = (lastPage?.order ?? -1) + 1;

    await prisma.$transaction(async (tx) => {
      for (const photo of validPhotos) {
        const storeId = storeById.get(photo.id);
        if (!storeId) continue;
        const page = await tx.bookPage.create({
          data: {
            bookId: input.bookId,
            storeId,
            order: pageOrder++,
          },
          select: { id: true },
        });
        await tx.bookItem.create({
          data: {
            bookId: input.bookId,
            bookPageId: page.id,
            pdvPhotoId: photo.id,
            slotIndex: 0,
            order: itemOrder++,
          },
        });
      }
    });

    return { added: validPhotos.length };
  });
