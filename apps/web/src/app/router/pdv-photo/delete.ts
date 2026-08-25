import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { resyncBooksForPhotos } from "@/features/books/server/resync-book";
import { z } from "zod";

export const deletePdvPhoto = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const photo = await prisma.pdvPhoto.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      // supplierId + capturedAt: o escopo do book a reconciliar depois da
      // exclusão (a foto já não existirá para consultar).
      select: { id: true, supplierId: true, capturedAt: true },
    });
    if (!photo) {
      throw errors.NOT_FOUND({ message: "Foto do PDV não encontrada" });
    }

    const result = await prisma.pdvPhoto.delete({ where: { id: input.id } });

    // Book vivo: excluir a foto a remove dos books do escopo (não enviados). O
    // BookItem some por cascade; o resync reempacota a página.
    await resyncBooksForPhotos(context.org.id, [
      { supplierId: photo.supplierId, capturedAt: photo.capturedAt },
    ]).catch(() => {});

    return result;
  });
