import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const listStore = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      search: z.string().optional(),
    }),
  )
  .output(
    z.object({
      stores: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          code: z.string().nullable(),
          managerName: z.string().nullable(),
          city: z.string().nullable(),
          state: z.string().nullable(),
          coverImageKey: z.string().nullable(),
          isActive: z.boolean(),
          floorPlansCount: z.number(),
          pdvPhotosCount: z.number(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context }) => {
    const stores = await prisma.store.findMany({
      where: {
        organizationId: context.org.id,
        name: input.search
          ? { contains: input.search, mode: "insensitive" }
          : undefined,
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
        managerName: true,
        city: true,
        state: true,
        coverImageKey: true,
        isActive: true,
        _count: { select: { floorPlans: true, pdvPhotos: true } },
      },
    });

    return {
      stores: stores.map((store) => ({
        id: store.id,
        name: store.name,
        code: store.code,
        managerName: store.managerName,
        city: store.city,
        state: store.state,
        coverImageKey: store.coverImageKey,
        isActive: store.isActive,
        floorPlansCount: store._count.floorPlans,
        pdvPhotosCount: store._count.pdvPhotos,
      })),
    };
  });
