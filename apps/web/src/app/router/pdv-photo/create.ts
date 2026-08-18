import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";
import {
  assertMapObjectInStore,
  assertMediaTypeInOrg,
  assertSupplierInOrg,
} from "./assert-relations";

export const createPdvPhoto = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      storeId: z.string(),
      mapObjectId: z.string().optional(),
      supplierId: z.string().optional(),
      mediaTypeId: z.string().optional(),
      section: z.string().optional(),
      responsibleCompany: z.string().optional(),
      managerName: z.string().optional(),
      coordinatorName: z.string().optional(),
      consultantName: z.string().optional(),
      code: z.string().optional(),
      actionValue: z.number().nonnegative().optional(),
      photos: z.array(z.string()).default([]),
      capturedAt: z.string().optional(),
      notes: z.string().optional(),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const store = await prisma.store.findFirst({
      where: { id: input.storeId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!store) {
      throw errors.NOT_FOUND({ message: "Loja não encontrada" });
    }

    if (input.supplierId) {
      await assertSupplierInOrg(input.supplierId, context.org.id, errors);
    }
    if (input.mediaTypeId) {
      await assertMediaTypeInOrg(input.mediaTypeId, context.org.id, errors);
    }
    if (input.mapObjectId) {
      await assertMapObjectInStore(
        input.mapObjectId,
        input.storeId,
        context.org.id,
        errors,
      );
    }

    const photoCapturedAt = input.capturedAt
      ? new Date(input.capturedAt)
      : new Date();

    const photo = await prisma.pdvPhoto.create({
      data: {
        organizationId: context.org.id,
        storeId: input.storeId,
        mapObjectId: input.mapObjectId,
        supplierId: input.supplierId,
        section: input.section,
        responsibleCompany: input.responsibleCompany,
        managerName: input.managerName,
        coordinatorName: input.coordinatorName,
        consultantName: input.consultantName,
        code: input.code,
        actionValue: input.actionValue,
        photos: input.photos,
        capturedAt: photoCapturedAt,
        notes: input.notes,
        createdById: context.user.id,
      },
      select: { id: true },
    });

    // Fotografar um ponto do mapa é uma visita: carimba data + promotor no elemento.
    if (input.mapObjectId) {
      await prisma.mapObject.updateMany({
        where: { id: input.mapObjectId, organizationId: context.org.id },
        data: {
          lastVisitAt: photoCapturedAt,
          lastEditedById: context.user.id,
        },
      });
    }

    return { id: photo.id };
  });
