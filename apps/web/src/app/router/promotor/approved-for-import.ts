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
        store: { select: { name: true } },
        supplier: { select: { name: true } },
      },
    });

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
          storeName: photo.store.name,
          supplierName: photo.supplier?.name ?? null,
        })),
    };
  });
