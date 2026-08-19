import { base } from "@/app/middlewares/base";
import { readFixtureProps } from "@/features/store-map/engine/fixture-catalog";
import type {
  BackgroundTransform,
  FloorPlanScene,
  Geometry,
  MapObjectStyle,
  SceneObject,
} from "@/features/store-map/engine/types";
import prisma from "@/lib/db";
import { z } from "zod";
import { resolvePublicStore } from "./_resolve-public-store";

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
      // Usa o resolvedor comum em vez de reimplementar o portão: a checagem
      // inline daqui esquecia `store.isActive`, então a planta de uma loja
      // desativada continuava pública para quem tivesse a URL. Agora que o mapa
      // de campo distribui essas URLs, o descuido deixa de ser teórico.
      const { organizationId, storeId } = await resolvePublicStore(
        input.orgSlug,
        input.storeId,
        errors,
      );

      const floorPlan = await prisma.floorPlan.findFirst({
        where: {
          organizationId,
          storeId,
          ...(input.floorPlanId ? { id: input.floorPlanId } : {}),
        },
        orderBy: { createdAt: "asc" },
        include: { layers: { orderBy: { order: "asc" } }, objects: true },
      });

      if (!floorPlan)
        throw errors.NOT_FOUND({ message: "Mapa não encontrado" });

      const objects: SceneObject[] = floorPlan.objects.map((object) => {
        // Só os campos FÍSICOS do mobiliário (dimensões + prateleiras
        // negociadas) — colore a célula e desenha o badge "X/Y" no público.
        // Nada comercial (a negociação em `properties.negotiation` fica fora).
        const fixture = readFixtureProps(
          object.properties as Record<string, unknown> | null,
        );
        return {
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
          properties: fixture
            ? {
                fixture: {
                  presetId: fixture.presetId,
                  kind: fixture.kind,
                  shelfCount: fixture.shelfCount,
                  negotiatedShelves: fixture.negotiatedShelves,
                  negotiatedShelfIndexes: fixture.negotiatedShelfIndexes,
                },
              }
            : {},
        };
      });

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
              where: { organizationId, id: { in: mediaTypeIds } },
              select: { id: true, code: true, name: true },
              orderBy: { sortOrder: "asc" },
            })
          : [],
        prisma.storeSector.findMany({
          where: { organizationId },
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
