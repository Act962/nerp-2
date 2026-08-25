import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireScope } from "@/app/middlewares/scope";
import type { MapObjectType } from "@/generated/prisma/client";
import { NEGOTIABLE_TYPES } from "@/features/store-map/engine/space-state";
import prisma from "@/lib/db";
import { z } from "zod";

const NEGOTIABLE_TYPE_LIST = [...NEGOTIABLE_TYPES] as MapObjectType[];

// Oportunidades comerciais: espaços vagos (LIVRE) + espaços cuja negociação
// fechada está vencendo dentro do horizonte. Base do que o Forge vai automatizar.
export const listOpportunities = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireScope("pdv:read"))
  .input(
    z.object({
      storeId: z.string().optional(),
      horizonDays: z.number().int().min(1).max(365).default(30),
    }),
  )
  .handler(async ({ input, context }) => {
    const storeFilter = input.storeId
      ? { floorPlan: { storeId: input.storeId } }
      : {};

    const horizonEnd = new Date();
    horizonEnd.setDate(horizonEnd.getDate() + input.horizonDays);

    const [vacant, expiring] = await Promise.all([
      prisma.mapObject.findMany({
        where: {
          organizationId: context.org.id,
          type: { in: NEGOTIABLE_TYPE_LIST },
          spaceState: "LIVRE",
          ...storeFilter,
        },
        select: {
          id: true,
          spaceCode: true,
          name: true,
          type: true,
          category: true,
          floorPlan: { select: { storeId: true } },
        },
        orderBy: { spaceCode: "asc" },
      }),
      prisma.spaceNegotiation.findMany({
        where: {
          organizationId: context.org.id,
          status: "FECHADA",
          endDate: { gte: new Date(), lte: horizonEnd },
          mapObject: { type: { in: NEGOTIABLE_TYPE_LIST }, ...storeFilter },
        },
        select: {
          id: true,
          endDate: true,
          supplierId: true,
          mapObject: {
            select: {
              id: true,
              spaceCode: true,
              name: true,
              type: true,
              category: true,
              floorPlan: { select: { storeId: true } },
            },
          },
        },
        orderBy: { endDate: "asc" },
      }),
    ]);

    return {
      vacant: vacant.map((space) => ({
        mapObjectId: space.id,
        spaceCode: space.spaceCode,
        name: space.name,
        type: space.type,
        category: space.category,
        storeId: space.floorPlan.storeId,
      })),
      expiring: expiring.map((negotiation) => ({
        mapObjectId: negotiation.mapObject.id,
        spaceCode: negotiation.mapObject.spaceCode,
        name: negotiation.mapObject.name,
        type: negotiation.mapObject.type,
        category: negotiation.mapObject.category,
        storeId: negotiation.mapObject.floorPlan.storeId,
        negotiationId: negotiation.id,
        endDate: negotiation.endDate?.toISOString() ?? null,
        supplierId: negotiation.supplierId,
      })),
    };
  });
