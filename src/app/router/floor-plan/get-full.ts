import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import type {
  BackgroundTransform,
  FloorPlanScene,
  Geometry,
  MapObjectStyle,
  SceneObject,
} from "@/features/store-map/engine/types";
import prisma from "@/lib/db";
import { z } from "zod";

export const getFullFloorPlan = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }): Promise<FloorPlanScene> => {
    const now = new Date();
    const floorPlan = await prisma.floorPlan.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      include: {
        layers: { orderBy: { order: "asc" } },
        objects: {
          include: {
            // Negociação FECHADA vigente hoje (entre startDate/endDate), a
            // mais recente. `take: 1` no include evita N+1 — um único join,
            // não uma query por objeto. Alimenta o filtro/heatmap da Fase 4.
            negotiations: {
              where: {
                status: "FECHADA",
                startDate: { lte: now },
                endDate: { gte: now },
              },
              orderBy: { startDate: "desc" },
              take: 1,
              select: {
                id: true,
                negotiationTypeId: true,
                amount: true,
                endDate: true,
              },
            },
          },
        },
      },
    });

    if (!floorPlan) {
      throw errors.NOT_FOUND({ message: "Mapa não encontrado" });
    }

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
      status: object.status,
      category: object.category,
      responsibleName: object.responsibleName,
      lastVisitAt: object.lastVisitAt?.toISOString() ?? null,
      supplierId: object.supplierId,
      brandId: object.brandId,
      mediaTypeId: object.mediaTypeId,
      sectorId: object.sectorId,
      tier: object.tier,
      flowLevel: object.flowLevel,
      visibility: object.visibility,
      isExclusive: object.isExclusive,
      revenuePotential: object.revenuePotential
        ? Number(object.revenuePotential)
        : null,
      avgSalesAmount: object.avgSalesAmount
        ? Number(object.avgSalesAmount)
        : null,
      properties: (object.properties as Record<string, unknown> | null) ?? {},
      activeNegotiation: object.negotiations[0]
        ? {
            id: object.negotiations[0].id,
            negotiationTypeId: object.negotiations[0].negotiationTypeId,
            amount: object.negotiations[0].amount
              ? Number(object.negotiations[0].amount)
              : null,
            endDate: object.negotiations[0].endDate?.toISOString() ?? null,
          }
        : null,
    }));

    return {
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
          (floorPlan.backgroundTransform as BackgroundTransform | null) ?? null,
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
    };
  });
