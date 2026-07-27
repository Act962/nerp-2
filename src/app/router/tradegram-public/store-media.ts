import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import { z } from "zod";

// Detalhe de um tipo de mídia numa loja pública: cada espaço físico (MapObject)
// daquele tipo vira um card, com as fotos REAIS aprovadas do promotor. Uma
// "Ponta de gôndola" pode ter várias na loja — todas aparecem aqui. Fotos soltas
// (capturadas sem espaço no mapa) também entram. Sem foto, cai na de referência.
export const getPublicStoreMedia = base
  .route({
    method: "GET",
    summary: "Detalhe de um tipo de mídia numa loja (TradeGram)",
    tags: ["tradegram-public"],
  })
  .input(
    z.object({
      orgSlug: z.string().min(1),
      storeId: z.string().min(1),
      mediaCode: z.string().min(1),
    }),
  )
  .handler(async ({ input, errors }) => {
    const org = await prisma.organization.findUnique({
      where: { slug: input.orgSlug },
      select: { id: true, isPublicProfile: true },
    });
    if (!org || !org.isPublicProfile) {
      throw errors.NOT_FOUND({ message: "Perfil não encontrado" });
    }

    const store = await prisma.store.findFirst({
      where: { id: input.storeId, organizationId: org.id, isActive: true },
      select: { id: true, name: true },
    });
    if (!store) throw errors.NOT_FOUND({ message: "Loja não encontrada" });

    const mediaType = await prisma.mediaType.findFirst({
      where: { organizationId: org.id, code: input.mediaCode },
      select: { id: true, code: true, name: true, defaultPhotos: true },
    });
    if (!mediaType) throw errors.NOT_FOUND({ message: "Mídia não encontrada" });

    const fallbackPhotos = mediaType.defaultPhotos.slice(0, 1);

    // Espaços físicos daquele tipo na loja, com as fotos aprovadas de cada um.
    const objects = await prisma.mapObject.findMany({
      where: {
        organizationId: org.id,
        floorPlan: { storeId: store.id },
        mediaTypeId: mediaType.id,
      },
      select: {
        id: true,
        name: true,
        spaceCode: true,
        spaceState: true,
        updatedAt: true,
        supplier: { select: { id: true, name: true } },
        pdvPhotos: {
          where: { approvalStatus: "APPROVED" },
          orderBy: { capturedAt: "desc" },
          select: { photos: true },
        },
      },
    });

    // Fotos capturadas para o tipo sem estar amarradas a um espaço do mapa.
    const loosePhotos = await prisma.pdvPhoto.findMany({
      where: {
        organizationId: org.id,
        storeId: store.id,
        mediaTypeId: mediaType.id,
        mapObjectId: null,
        approvalStatus: "APPROVED",
      },
      orderBy: { capturedAt: "desc" },
      select: {
        id: true,
        section: true,
        capturedAt: true,
        photos: true,
        supplier: { select: { id: true, name: true } },
      },
    });

    const fromObjects = objects.map((object) => {
      const photos = object.pdvPhotos
        .flatMap((photo) => photo.photos)
        .slice(0, 8);
      return {
        id: object.id,
        label: object.name || object.spaceCode || "Espaço",
        active: object.spaceState === "EXECUTADO",
        supplier: object.supplier,
        photos: photos.length > 0 ? photos : fallbackPhotos,
        sortKey: object.updatedAt.getTime(),
      };
    });

    const fromLoose = loosePhotos.map((photo) => ({
      id: photo.id,
      label: photo.section || photo.supplier?.name || "Registro",
      active: true,
      supplier: photo.supplier,
      photos:
        photo.photos.length > 0 ? photo.photos.slice(0, 8) : fallbackPhotos,
      sortKey: photo.capturedAt.getTime(),
    }));

    // Ativos primeiro; dentro do grupo, os modificados por último no topo.
    const instances = [...fromObjects, ...fromLoose]
      .sort((first, second) => {
        if (first.active !== second.active) return first.active ? -1 : 1;
        return second.sortKey - first.sortKey;
      })
      .map((instance) => ({
        id: instance.id,
        label: instance.label,
        active: instance.active,
        supplier: instance.supplier,
        photos: instance.photos,
      }));

    return {
      media: { code: mediaType.code, name: mediaType.name },
      storeName: store.name,
      instances,
    };
  });
