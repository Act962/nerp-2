import { base } from "@/app/middlewares/base";
import type {
  BackgroundTransform,
  FloorPlanScene,
  Geometry,
  MapObjectStyle,
  SceneObject,
} from "@/features/store-map/engine/types";
import prisma from "@/lib/db";
import { z } from "zod";

// Mapa Konva público read-only. Espelha floor-plan/get-full.ts, mas com
// ALLOWLIST explícita: devolve só o que desenha e classifica o espaço. Zera
// tudo que é comercial (negociação/valores) ou pessoal (nomes/visitas). Nunca
// use `...object` aqui — cada campo é escolhido a dedo de propósito.
export const getPublicStoreMap = base
  .route({
    method: "GET",
    summary: "Mapa público (TradeGram)",
    tags: ["tradegram-public"],
  })
  .input(
    z.object({
      orgSlug: z.string().min(1),
      storeId: z.string().min(1),
      floorPlanId: z.string().optional(),
    }),
  )
  .handler(
    async ({
      input,
      errors,
    }): Promise<{
      scene: FloorPlanScene;
      // De-para dos tipos de mídia presentes, para o filtro público resolver
      // ?media=<code> → mediaTypeId (o filtro do mapa trabalha por id).
      mediaTypes: { id: string; code: string; name: string }[];
      // Setores da org, para o painel público resolver sectorId → nome.
      sectors: { id: string; name: string }[];
    }> => {
      const org = await prisma.organization.findUnique({
        where: { slug: input.orgSlug },
        select: { id: true, isPublicProfile: true },
      });
      if (!org || !org.isPublicProfile) {
        throw errors.NOT_FOUND({ message: "Perfil não encontrado" });
      }

      const floorPlan = input.floorPlanId
        ? await prisma.floorPlan.findFirst({
            where: {
              id: input.floorPlanId,
              organizationId: org.id,
              storeId: input.storeId,
            },
            include: { layers: { orderBy: { order: "asc" } }, objects: true },
          })
        : await prisma.floorPlan.findFirst({
            where: { organizationId: org.id, storeId: input.storeId },
            orderBy: { createdAt: "asc" },
            include: { layers: { orderBy: { order: "asc" } }, objects: true },
          });

      if (!floorPlan)
        throw errors.NOT_FOUND({ message: "Mapa não encontrado" });

      const objects: SceneObject[] = floorPlan.objects.map((object) => ({
        id: object.id,
        type: object.type,
        layerId: object.layerId,
        geometry: object.geometry as unknown as Geometry,
        z: object.z,
        heightM: object.heightM,
        style: (object.style as MapObjectStyle | null) ?? {},
        name: object.name,
        spaceState: object.spaceState,
        spaceCode: object.spaceCode,
        spaceSeq: object.spaceSeq,
        // Classificação visual pública (colore o mapa), sem valor comercial:
        mediaTypeId: object.mediaTypeId,
        sectorId: object.sectorId,
        tier: object.tier,
        flowLevel: object.flowLevel,
        visibility: object.visibility,
        isExclusive: object.isExclusive,
        // ── Nulados de propósito (comercial/pessoal): não vazam no público ──
        status: null,
        category: null,
        responsibleName: null,
        lastVisitAt: null,
        supplierId: null,
        brandId: null,
        revenuePotential: null,
        avgSalesAmount: null,
        activeNegotiation: null,
        properties: {},
      }));

      const mediaTypeIds = [
        ...new Set(
          floorPlan.objects
            .map((object) => object.mediaTypeId)
            .filter((id): id is string => id !== null),
        ),
      ];
      const [mediaTypes, sectors] = await Promise.all([
        mediaTypeIds.length > 0
          ? prisma.mediaType.findMany({
              where: { organizationId: org.id, id: { in: mediaTypeIds } },
              select: { id: true, code: true, name: true },
              orderBy: { sortOrder: "asc" },
            })
          : [],
        prisma.storeSector.findMany({
          where: { organizationId: org.id },
          select: { id: true, name: true },
          orderBy: { sortOrder: "asc" },
        }),
      ]);

      return {
        scene: {
          floorPlan: {
            id: floorPlan.id,
            storeId: floorPlan.storeId,
            name: floorPlan.name,
            widthM: floorPlan.widthM,
            heightM: floorPlan.heightM,
            pixelsPerMeter: floorPlan.pixelsPerMeter,
            backgroundImageKey: floorPlan.backgroundImageKey,
            backgroundOpacity: floorPlan.backgroundOpacity,
            backgroundTransform:
              (floorPlan.backgroundTransform as BackgroundTransform | null) ??
              null,
          },
          layers: floorPlan.layers.map((layer) => ({
            id: layer.id,
            name: layer.name,
            order: layer.order,
            visible: layer.visible,
            locked: layer.locked,
            color: layer.color,
          })),
          objects,
        },
        mediaTypes,
        sectors,
      };
    },
  );
