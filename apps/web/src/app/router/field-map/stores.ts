import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { storePublicPath } from "@/lib/store-slug";
import { z } from "zod";
import { resolveFieldActor } from "./_access";
import {
  RELIABLE_SAMPLES,
  mapStoreSchema,
  offMapStoreSchema,
} from "./_schemas";

// Lojas do mapa. Quem não é liderança vê só as lojas que cobre — mesmo recorte
// do `PromoterStore` que autoriza a captura.
export const listMapStores = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}))
  .output(
    z.object({
      canSeeAll: z.boolean(),
      stores: z.array(mapStoreSchema),
      offMap: z.array(offMapStoreSchema),
    }),
  )
  .handler(async ({ context, errors }) => {
    const actor = await resolveFieldActor(context.org.id, context.user.id);
    if (!actor) {
      throw errors.FORBIDDEN({
        message: "Você não é membro desta organização",
      });
    }

    const scope = {
      organizationId: context.org.id,
      ...(actor.canSeeAll
        ? {}
        : { promoterLinks: { some: { memberId: actor.memberId } } }),
    };

    const stores = await prisma.store.findMany({
      where: scope,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        state: true,
        latitude: true,
        longitude: true,
        geoSource: true,
        geoSampleCount: true,
        geoStatus: true,
        geoError: true,
        coverImageKey: true,
        isActive: true,
        slug: true,
      },
    });

    // A face pública das lojas PRÓPRIAS não passa pela ponte `osmId`: a
    // organização é conhecida, então basta saber se ela é pública e quais
    // lojas têm planta desenhada.
    const org = await prisma.organization.findUnique({
      where: { id: context.org.id },
      select: { slug: true, isPublicProfile: true },
    });
    const isPublic = Boolean(org?.isPublicProfile && org.slug);

    const [plans, barcodes] = isPublic
      ? await Promise.all([
          prisma.floorPlan.findMany({
            where: { organizationId: context.org.id },
            select: { storeId: true, _count: { select: { objects: true } } },
          }),
          prisma.product.count({
            where: {
              organizationId: context.org.id,
              isActive: true,
              barcode: { not: null },
            },
            take: 1,
          }),
        ])
      : [[], 0];

    const withPlan = new Set(
      plans.filter((plan) => plan._count.objects > 0).map((p) => p.storeId),
    );

    // Uma consulta só, separada aqui: a lista "fora do mapa" é o que dá ao
    // usuário o caminho para consertar, e some sozinha conforme as fotos chegam.
    const onMap: z.infer<typeof mapStoreSchema>[] = [];
    const offMap: z.infer<typeof offMapStoreSchema>[] = [];

    for (const store of stores) {
      if (
        store.latitude !== null &&
        store.longitude !== null &&
        store.geoSource !== null
      ) {
        onMap.push({
          id: store.id,
          name: store.name,
          address: store.address,
          city: store.city,
          state: store.state,
          latitude: store.latitude,
          longitude: store.longitude,
          geoSource: store.geoSource,
          geoSampleCount: store.geoSampleCount,
          coverImageKey: store.coverImageKey,
          isReliable:
            store.geoSource === "MANUAL" ||
            store.geoSource === "IMPORTED" ||
            store.geoSampleCount >= RELIABLE_SAMPLES,
          public:
            isPublic && store.isActive && org?.slug
              ? {
                  path: storePublicPath(org.slug, store.id, store.slug),
                  hasFloorPlan: withPlan.has(store.id),
                  hasPriceScan: barcodes > 0,
                }
              : null,
        });
        continue;
      }

      offMap.push({
        id: store.id,
        name: store.name,
        address: store.address,
        city: store.city,
        state: store.state,
        geoStatus: store.geoStatus,
        geoError: store.geoError,
      });
    }

    return { canSeeAll: actor.canSeeAll, stores: onMap, offMap };
  });
