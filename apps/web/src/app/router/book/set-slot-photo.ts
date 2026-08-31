import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";
import { assignSlotPhoto } from "./_slot";

// Define (ou substitui) a foto de um slot dentro de uma BookPage. Se o slot
// já tem um item, troca o pdvPhotoId; senão, cria um item novo naquele slot.
// Usado pelo editor pra "trocar" a foto de um slot já preenchido e pra
// preencher slots vazios após uma remoção.
export const setSlotPhoto = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      bookPageId: z.string(),
      slotIndex: z.number().int().min(0).max(3),
      pdvPhotoId: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const page = await prisma.bookPage.findFirst({
      where: {
        id: input.bookPageId,
        book: { organizationId: context.org.id },
      },
      select: { id: true, bookId: true },
    });
    if (!page) throw errors.NOT_FOUND({ message: "Página não encontrada" });

    const photo = await prisma.pdvPhoto.findFirst({
      where: { id: input.pdvPhotoId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!photo) throw errors.NOT_FOUND({ message: "Foto não encontrada" });

    return assignSlotPhoto(prisma, {
      bookId: page.bookId,
      bookPageId: page.id,
      slotIndex: input.slotIndex,
      pdvPhotoId: input.pdvPhotoId,
    });
  });
