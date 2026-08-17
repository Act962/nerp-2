import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { canManageStores } from "@/app/router/field-map/_can-manage-stores";
import prisma from "@/lib/db";
import { distanceMeters } from "@/lib/geo-distance";
import { normalizeStoreName } from "@/lib/store-name";
import { z } from "zod";

/** A menos disto, é a mesma loja física — mesmo com nome diferente. */
const NEAR_METERS = 250;
/** Janela grosseira (~2 km) antes do filtro fino de distância. */
const BOX_DEGREES = 0.02;
/** Teto de lojas analisadas por chamada. */
const MAX_STORES = 500;

/**
 * Lojas da org que já têm posição (as que os promotores usaram pra fotografar)
 * e batem, POR LOCALIZAÇÃO, com um ponto do diretório Tradegram cujo nome é
 * diferente — os "lixos" de nome divergente pro mesmo endereço. Alimenta o card
 * "N lojas para mesclar" em /lojas. Só lê.
 */
export const listMergeCandidates = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .output(
    z.object({
      candidates: z.array(
        z.object({
          storeId: z.string(),
          storeName: z.string(),
          directoryStoreId: z.string(),
          directoryName: z.string(),
          directoryCity: z.string().nullable(),
          distanceM: z.number(),
        }),
      ),
    }),
  )
  .handler(async ({ context, errors }) => {
    if (!(await canManageStores(context.org.id, context.user.id))) {
      throw errors.FORBIDDEN({ message: "Sem permissão" });
    }

    const stores = await prisma.store.findMany({
      where: {
        organizationId: context.org.id,
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
        directoryStoreId: true,
      },
      take: MAX_STORES,
    });

    const candidates: {
      storeId: string;
      storeName: string;
      directoryStoreId: string;
      directoryName: string;
      directoryCity: string | null;
      distanceM: number;
    }[] = [];

    for (const store of stores) {
      const lat = store.latitude as number;
      const lng = store.longitude as number;
      const nearby = await prisma.directoryStore.findMany({
        where: {
          latitude: { gte: lat - BOX_DEGREES, lte: lat + BOX_DEGREES },
          longitude: { gte: lng - BOX_DEGREES, lte: lng + BOX_DEGREES },
        },
        select: {
          id: true,
          name: true,
          city: true,
          latitude: true,
          longitude: true,
        },
        take: 50,
      });

      let best: {
        id: string;
        name: string;
        city: string | null;
        distance: number;
      } | null = null;
      for (const point of nearby) {
        if (point.latitude === null || point.longitude === null) continue;
        const distance = distanceMeters(
          { latitude: lat, longitude: lng },
          { latitude: point.latitude, longitude: point.longitude },
        );
        if (distance > NEAR_METERS) continue;
        if (!best || distance < best.distance) {
          best = {
            id: point.id,
            name: point.name,
            city: point.city,
            distance,
          };
        }
      }
      if (!best) continue;

      // Candidato = há ponto perto E ele não é o já vinculado com o mesmo nome.
      const alreadyAligned =
        store.directoryStoreId === best.id &&
        normalizeStoreName(store.name) === normalizeStoreName(best.name);
      if (alreadyAligned) continue;

      candidates.push({
        storeId: store.id,
        storeName: store.name,
        directoryStoreId: best.id,
        directoryName: best.name,
        directoryCity: best.city,
        distanceM: Math.round(best.distance),
      });
    }

    return { candidates };
  });
