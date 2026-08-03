import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";
import { assertSupplierInOrg } from "../pdv-photo/assert-relations";
import { assertPromoterLink } from "./assert-promoter-link";
import { refreshStorePositionFromPhotos } from "./_store-position";

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
      // Endereço resolvido no reverse-geocode da captura. Serve de prova de
      // onde a foto foi tirada e alimenta o endereço da loja quando vazio.
      capturedAddress: z.string().optional(),
      capturedRoad: z.string().optional(),
      capturedHouseNumber: z.string().optional(),
      capturedSuburb: z.string().optional(),
      /** A composição no celular não conseguiu carregar o selo da indústria. */
      sealMissing: z.boolean().default(false),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    // Perfil incompleto trava a captura. A tela já bloqueia antes, mas a regra
    // vive aqui: sem rosto e telefone a foto entra no book sem quem responda
    // por ela, e é isso que a obrigatoriedade existe para impedir.
    const profile = await prisma.user.findUnique({
      where: { id: context.user.id },
      select: { image: true, whatsapp: true },
    });
    if (!profile?.image || !profile?.whatsapp) {
      throw errors.FORBIDDEN({
        message:
          "Complete seu perfil (foto do rosto e WhatsApp) antes de capturar fotos",
      });
    }

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
        sealMissing: input.sealMissing,
        capturedCity: input.capturedCity ?? null,
        capturedState: input.capturedState ?? null,
        capturedAddress: input.capturedAddress ?? null,
        capturedLatitude: input.latitude ?? null,
        capturedLongitude: input.longitude ?? null,
        createdById: context.user.id,
      },
      select: { id: true },
    });

    // A posição da loja nasce do trabalho de campo: o promotor está na porta
    // quando fotografa. Best-effort — nunca derruba a captura.
    if (input.latitude !== undefined && input.longitude !== undefined) {
      await refreshStorePositionFromPhotos({
        organizationId: context.org.id,
        storeId: store.id,
        place: {
          road: input.capturedRoad ?? null,
          houseNumber: input.capturedHouseNumber ?? null,
          suburb: input.capturedSuburb ?? null,
          city: input.capturedCity ?? null,
          state: input.capturedState ?? null,
          label: input.capturedAddress ?? null,
        },
      });
    }

    return { id: photo.id };
  });
