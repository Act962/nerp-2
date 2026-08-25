import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Fotos APROVADAS de um cliente+indústria, para a coordenadora importar no book.
export const listApprovedForImport = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      storeId: z.string().optional(),
      supplierId: z.string().optional(),
      // Quando informado, marca `usedInBook` nas fotos já usadas em qualquer
      // página deste book — pro picker avisar sobre repetição.
      bookId: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const photos = await prisma.pdvPhoto.findMany({
      where: {
        organizationId: context.org.id,
        approvalStatus: "APPROVED",
        promoterName: { not: null },
        ...(input.storeId ? { storeId: input.storeId } : {}),
        ...(input.supplierId ? { supplierId: input.supplierId } : {}),
      },
      orderBy: { capturedAt: "desc" },
      select: {
        id: true,
        photos: true,
        code: true,
        promoterName: true,
        capturedAt: true,
        capturedCity: true,
        capturedState: true,
        mediaTypeId: true,
        mediaType: { select: { id: true, code: true, name: true } },
        store: { select: { name: true } },
        supplier: { select: { name: true } },
      },
    });

    // Fotos já usadas em alguma página deste book (qualquer página): o picker
    // marca "já usada" e pede confirmação antes de repetir.
    const usedInBook = new Set<string>();
    if (input.bookId) {
      const used = await prisma.bookItem.findMany({
        where: {
          bookId: input.bookId,
          book: { organizationId: context.org.id },
          pdvPhotoId: { in: photos.map((p) => p.id) },
        },
        select: { pdvPhotoId: true },
      });
      for (const item of used) usedInBook.add(item.pdvPhotoId);
    }

    return {
      photos: photos
        .filter((photo) => photo.photos[0])
        .map((photo) => ({
          id: photo.id,
          photoKey: photo.photos[0],
          code: photo.code,
          promoterName: photo.promoterName,
          capturedAt: photo.capturedAt.toISOString(),
          capturedCity: photo.capturedCity,
          capturedState: photo.capturedState,
          mediaTypeId: photo.mediaTypeId,
          mediaType: photo.mediaType,
          storeName: photo.store.name,
          supplierName: photo.supplier?.name ?? null,
          usedInBook: usedInBook.has(photo.id),
        })),
    };
  });
