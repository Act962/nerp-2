import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const listPdvPhoto = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      storeId: z.string().optional(),
      mapObjectId: z.string().optional(),
      // Fotos tiradas em campo antes de a loja ter mapa — as candidatas a
      // vincular a um espaço depois.
      unlinkedOnly: z.boolean().optional(),
      supplierId: z.string().optional(),
      mediaTypeId: z.string().optional(),
      section: z.string().optional(),
      responsibleCompany: z.string().optional(),
      coordinatorName: z.string().optional(),
      consultantName: z.string().optional(),
      code: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const capturedAt =
      input.dateFrom || input.dateTo
        ? {
            gte: input.dateFrom ? new Date(input.dateFrom) : undefined,
            lte: input.dateTo ? new Date(input.dateTo) : undefined,
          }
        : undefined;

    const photos = await prisma.pdvPhoto.findMany({
      where: {
        organizationId: context.org.id,
        storeId: input.storeId,
        mapObjectId: input.unlinkedOnly ? null : input.mapObjectId,
        supplierId: input.supplierId,
        mediaTypeId: input.mediaTypeId,
        section: input.section,
        responsibleCompany: input.responsibleCompany,
        coordinatorName: input.coordinatorName,
        consultantName: input.consultantName,
        code: input.code,
        capturedAt,
      },
      orderBy: { capturedAt: "desc" },
      select: {
        id: true,
        storeId: true,
        mapObjectId: true,
        supplierId: true,
        mediaTypeId: true,
        section: true,
        responsibleCompany: true,
        coordinatorName: true,
        consultantName: true,
        code: true,
        actionValue: true,
        photos: true,
        notes: true,
        capturedAt: true,
        store: { select: { name: true, managerName: true } },
        supplier: { select: { name: true } },
        mediaType: { select: { name: true, code: true } },
      },
    });

    return {
      photos: photos.map((photo) => ({
        id: photo.id,
        storeId: photo.storeId,
        storeName: photo.store.name,
        storeManager: photo.store.managerName,
        mapObjectId: photo.mapObjectId,
        supplierId: photo.supplierId,
        supplierName: photo.supplier?.name ?? null,
        mediaTypeId: photo.mediaTypeId,
        mediaTypeName: photo.mediaType?.name ?? null,
        mediaTypeCode: photo.mediaType?.code ?? null,
        section: photo.section,
        responsibleCompany: photo.responsibleCompany,
        coordinatorName: photo.coordinatorName,
        consultantName: photo.consultantName,
        code: photo.code,
        actionValue: photo.actionValue ? Number(photo.actionValue) : null,
        photos: photo.photos,
        notes: photo.notes,
        capturedAt: photo.capturedAt.toISOString(),
      })),
    };
  });
