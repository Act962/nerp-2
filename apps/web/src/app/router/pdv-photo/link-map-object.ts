import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";
import { assertMapObjectInStore } from "./assert-relations";

// Vincula uma foto tirada em campo (sem mapa) a um espaço do mapa criado
// depois. Procedure dedicada e não um campo no `update` porque a validação é
// relacional (o espaço tem que ser da MESMA loja da foto), carimba visita no
// MapObject, e o `update` é chamado em rajada pelo autosave do BookPageCard.
export const linkPdvPhotoToMapObject = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      id: z.string(),
      mapObjectId: z.string().nullable(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const photo = await prisma.pdvPhoto.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true, storeId: true, mediaTypeId: true },
    });
    if (!photo) {
      throw errors.NOT_FOUND({ message: "Foto do PDV não encontrada" });
    }

    if (input.mapObjectId === null) {
      await prisma.pdvPhoto.update({
        where: { id: photo.id },
        data: { mapObjectId: null },
      });
      return {
        id: photo.id,
        mapObjectId: null,
        mediaTypeId: photo.mediaTypeId,
        mediaTypeMismatch: false,
      };
    }

    const mapObject = await assertMapObjectInStore(
      input.mapObjectId,
      photo.storeId,
      context.org.id,
      errors,
    );

    // A foto herda a mídia do espaço só quando não tem uma própria. Se as duas
    // existem e divergem, não sobrescreve nenhuma — o que o promotor informou em
    // campo é o dado mais confiável; devolve o conflito pra UI perguntar.
    const shouldInherit = !photo.mediaTypeId && !!mapObject.mediaTypeId;
    const mediaTypeMismatch =
      !!photo.mediaTypeId &&
      !!mapObject.mediaTypeId &&
      photo.mediaTypeId !== mapObject.mediaTypeId;

    await prisma.$transaction([
      prisma.pdvPhoto.update({
        where: { id: photo.id },
        data: {
          mapObjectId: mapObject.id,
          mediaTypeId: shouldInherit ? mapObject.mediaTypeId : undefined,
        },
      }),
      prisma.mapObject.update({
        where: { id: mapObject.id },
        data: { lastVisitAt: new Date(), lastEditedById: context.user.id },
      }),
    ]);

    return {
      id: photo.id,
      mapObjectId: mapObject.id,
      mediaTypeId: shouldInherit ? mapObject.mediaTypeId : photo.mediaTypeId,
      mediaTypeMismatch,
    };
  });
