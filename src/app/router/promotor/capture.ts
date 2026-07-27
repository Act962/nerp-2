import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";
import { assertSupplierInOrg } from "../pdv-photo/assert-relations";
import { assertPromoterLink } from "./assert-promoter-link";

// Captura do promotor: a foto já vem carimbada (código + nome + data + geo) e
// enviada ao R2 pelo client; aqui só criamos o PdvPhoto com os metadados.
export const capturePromotorPhoto = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      storeId: z.string(),
      supplierId: z.string(),
      photoKey: z.string(),
      code: z.string().optional(),
      capturedAt: z.string().optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      capturedCity: z.string().optional(),
      capturedState: z.string().optional(),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const store = await prisma.store.findFirst({
      where: { id: input.storeId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!store) throw errors.NOT_FOUND({ message: "Loja não encontrada" });

    await assertSupplierInOrg(input.supplierId, context.org.id, errors);
    await assertPromoterLink(
      context.user.id,
      context.org.id,
      input.storeId,
      input.supplierId,
      errors,
    );

    const photo = await prisma.pdvPhoto.create({
      data: {
        organizationId: context.org.id,
        storeId: input.storeId,
        supplierId: input.supplierId,
        code: input.code,
        photos: [input.photoKey],
        capturedAt: input.capturedAt ? new Date(input.capturedAt) : new Date(),
        promoterName: context.user.name ?? null,
        capturedCity: input.capturedCity ?? null,
        capturedState: input.capturedState ?? null,
        capturedLatitude: input.latitude ?? null,
        capturedLongitude: input.longitude ?? null,
        createdById: context.user.id,
      },
      select: { id: true },
    });

    return { id: photo.id };
  });
