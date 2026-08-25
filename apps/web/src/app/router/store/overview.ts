import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const storeOverview = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}))
  .output(
    z.object({
      stores: z.number(),
      storesWithoutMap: z.number(),
      floorPlans: z.number(),
      pdvPhotos: z.number(),
      books: z.number(),
      booksReady: z.number(),
      booksPending: z.number(),
      actionValueTotal: z.number(),
    }),
  )
  .handler(async ({ context }) => {
    const organizationId = context.org.id;

    const [
      stores,
      storesWithoutMap,
      floorPlans,
      pdvPhotos,
      books,
      booksReady,
      actionValueAgg,
    ] = await Promise.all([
      prisma.store.count({ where: { organizationId } }),
      prisma.store.count({
        where: { organizationId, floorPlans: { none: {} } },
      }),
      prisma.floorPlan.count({ where: { organizationId } }),
      prisma.pdvPhoto.count({ where: { organizationId } }),
      prisma.book.count({ where: { organizationId } }),
      prisma.book.count({ where: { organizationId, status: "READY" } }),
      prisma.pdvPhoto.aggregate({
        where: { organizationId },
        _sum: { actionValue: true },
      }),
    ]);

    return {
      stores,
      storesWithoutMap,
      floorPlans,
      pdvPhotos,
      books,
      booksReady,
      booksPending: books - booksReady,
      actionValueTotal: Number(actionValueAgg._sum.actionValue ?? 0),
    };
  });
