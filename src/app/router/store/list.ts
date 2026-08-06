import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

const DEFAULT_PAGE_SIZE = 10;

export const listStore = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      search: z.string().optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(DEFAULT_PAGE_SIZE),
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
      totalCount: z.number(),
      page: z.number(),
      pageSize: z.number(),
      totalPages: z.number(),
    }),
  )
  .handler(async ({ input, context }) => {
    const { page, pageSize } = input;
    const search = input.search?.trim();

    const where = {
      organizationId: context.org.id,
      name: search
        ? { contains: search, mode: "insensitive" as const }
        : undefined,
    };

    const [stores, totalCount] = await Promise.all([
      prisma.store.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
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
      }),
      prisma.store.count({ where }),
    ]);

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
      totalCount,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    };
  });
