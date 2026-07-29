import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireScope } from "@/app/middlewares/scope";
import { type MapObjectType, MapSpaceState } from "@/generated/prisma/client";
import { NEGOTIABLE_TYPES } from "@/features/store-map/engine/space-state";
import prisma from "@/lib/db";
import { z } from "zod";

const NEGOTIABLE_TYPE_LIST = [...NEGOTIABLE_TYPES] as MapObjectType[];

// Lista os espaços negociáveis da org. Serve tanto ao app quanto ao Tracking
// Órbita via S2S — o scope `pdv:read` é o que autoriza a chave de integração.
export const listSpaces = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireScope("pdv:read"))
  .input(
    z.object({
      storeId: z.string().optional(),
      spaceState: z.enum(MapSpaceState).optional(),
      category: z.string().optional(),
      supplierId: z.string().optional(),
      limit: z.number().int().min(1).max(200).default(100),
      cursor: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const spaces = await prisma.mapObject.findMany({
      where: {
        organizationId: context.org.id,
        type: { in: NEGOTIABLE_TYPE_LIST },
        spaceState: input.spaceState,
        category: input.category,
        supplierId: input.supplierId,
        ...(input.storeId ? { floorPlan: { storeId: input.storeId } } : {}),
      },
      select: {
        id: true,
        spaceCode: true,
        name: true,
        type: true,
        spaceState: true,
        category: true,
        supplierId: true,
        brandId: true,
        mediaTypeId: true,
        mediaType: { select: { name: true } },
        floorPlan: { select: { id: true, storeId: true } },
      },
      orderBy: { spaceCode: "asc" },
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });

    const hasMore = spaces.length > input.limit;
    const items = hasMore ? spaces.slice(0, input.limit) : spaces;
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1]?.id : null,
    };
  });
