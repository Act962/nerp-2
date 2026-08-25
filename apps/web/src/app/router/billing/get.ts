import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { resolveEffectivePlan } from "@/features/billing/lib/plans";
import prisma from "@/lib/db";
import { z } from "zod";

const MB_PER_PHOTO = 0.4;

// Estado da assinatura de trade + uso atual (para comparar com as cotas do
// plano na tela de Plano & Assinatura).
export const getBilling = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}))
  .handler(async ({ context }) => {
    const organizationId = context.org.id;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      subscription,
      adminUsers,
      promoterSuppliers,
      promoterStores,
      promoterDistributors,
      photosThisMonth,
      pdvPhotosTotal,
      planograms,
      books,
    ] = await Promise.all([
      prisma.tradeSubscription.findUnique({
        where: { organizationId },
        select: {
          plan: true,
          status: true,
          currentPeriodEnd: true,
          extraUsers: true,
          extraPromoters: true,
          extraPhotos: true,
          extraStorageGb: true,
        },
      }),
      prisma.member.count({ where: { organizationId } }),
      prisma.promoterSupplier.findMany({
        where: { organizationId },
        select: { memberId: true },
        distinct: ["memberId"],
      }),
      prisma.promoterStore.findMany({
        where: { organizationId },
        select: { memberId: true },
        distinct: ["memberId"],
      }),
      prisma.promoterDistributor.findMany({
        where: { organizationId },
        select: { memberId: true },
        distinct: ["memberId"],
      }),
      prisma.pdvPhoto.count({
        where: { organizationId, createdAt: { gte: monthStart } },
      }),
      prisma.pdvPhoto.count({ where: { organizationId } }),
      prisma.planogram.count({ where: { organizationId } }),
      prisma.book.count({ where: { organizationId } }),
    ]);

    const promoters = new Set([
      ...promoterSuppliers.map((row) => row.memberId),
      ...promoterStores.map((row) => row.memberId),
      ...promoterDistributors.map((row) => row.memberId),
    ]).size;

    const effectivePlan = resolveEffectivePlan(
      subscription
        ? { plan: subscription.plan, status: subscription.status }
        : null,
    );

    return {
      effectivePlan,
      subscription: subscription
        ? {
            plan: subscription.plan,
            status: subscription.status,
            currentPeriodEnd:
              subscription.currentPeriodEnd?.toISOString() ?? null,
            extraUsers: subscription.extraUsers,
            extraPromoters: subscription.extraPromoters,
            extraPhotos: subscription.extraPhotos,
            extraStorageGb: subscription.extraStorageGb,
          }
        : null,
      usage: {
        adminUsers,
        promoters,
        photosThisMonth,
        planograms,
        books,
        storageEstimateGb: Number(
          ((pdvPhotosTotal * MB_PER_PHOTO) / 1024).toFixed(2),
        ),
      },
    };
  });
