import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { canManageStores } from "@/app/router/field-map/_can-manage-stores";
import prisma from "@/lib/db";
import { distanceMeters } from "@/lib/geo-distance";
import { z } from "zod";

/** Folga na re-checagem de distância no server (anti-spoof). */
const MAX_MERGE_METERS = 400;

/**
 * Alinha uma loja da org ao ponto canônico do diretório Tradegram: adota o nome
 * do diretório e grava o vínculo `directoryStoreId`. NÃO-destrutivo — a `Store`
 * mantém o MESMO id, então as fotos (FK por id) ficam intactas. Não apaga loja,
 * não move foto, não mexe em pino `MANUAL`.
 */
export const mergeStoreWithDirectory = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ storeId: z.string(), directoryStoreId: z.string() }))
  .output(z.object({ id: z.string(), name: z.string() }))
  .handler(async ({ input, context, errors }) => {
    if (!(await canManageStores(context.org.id, context.user.id))) {
      throw errors.FORBIDDEN({ message: "Sem permissão" });
    }

    const store = await prisma.store.findFirst({
      where: { id: input.storeId, organizationId: context.org.id },
      select: { id: true, latitude: true, longitude: true },
    });
    if (!store) throw errors.NOT_FOUND({ message: "Loja não encontrada" });

    const directory = await prisma.directoryStore.findUnique({
      where: { id: input.directoryStoreId },
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
        address: true,
        city: true,
        state: true,
      },
    });
    if (!directory) {
      throw errors.NOT_FOUND({ message: "Ponto do diretório não encontrado" });
    }

    // Re-checa a proximidade no server: só mescla o que de fato está no local
    // (evita alinhar a loja errada por um id forjado).
    if (
      store.latitude !== null &&
      store.longitude !== null &&
      directory.latitude !== null &&
      directory.longitude !== null
    ) {
      const distance = distanceMeters(
        { latitude: store.latitude, longitude: store.longitude },
        { latitude: directory.latitude, longitude: directory.longitude },
      );
      if (distance > MAX_MERGE_METERS) {
        throw errors.BAD_REQUEST({
          message: "Esse ponto do diretório está longe demais desta loja",
        });
      }
    }

    // Loja sem posição adota a do diretório; loja com pino confiável mantém o dela.
    const adoptPosition =
      store.latitude === null &&
      directory.latitude !== null &&
      directory.longitude !== null;

    const updated = await prisma.store.update({
      where: { id: store.id },
      data: {
        name: directory.name,
        directoryStoreId: directory.id,
        ...(adoptPosition
          ? {
              latitude: directory.latitude,
              longitude: directory.longitude,
              address: directory.address,
              city: directory.city,
              state: directory.state,
              geoSource: "GEOCODED" as const,
              geoStatus: "OK" as const,
              geoUpdatedAt: new Date(),
            }
          : {}),
      },
      select: { id: true, name: true },
    });

    return updated;
  });
