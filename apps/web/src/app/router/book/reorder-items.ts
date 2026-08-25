import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const reorderBookItems = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      bookId: z.string(),
      orderedPdvPhotoIds: z.array(z.string()),
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

    await prisma.$transaction(
      input.orderedPdvPhotoIds.map((pdvPhotoId, index) =>
        prisma.bookItem.updateMany({
          where: { bookId: input.bookId, pdvPhotoId },
          data: { order: index },
        }),
      ),
    );

    return { success: true };
  });
