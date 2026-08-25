import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Painel do Trade Marketing: agrega indicadores de todas as funcionalidades
// (lojas/mapas, promotor/fotos, books, cadastros, catálogo, planograma,
// negociações). Escopado por org. É o dashboard interno (autenticado), então
// pode mostrar valores comerciais da própria org.
export const getTradeDashboard = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}))
  .handler(async ({ context }) => {
    const organizationId = context.org.id;
    const now = new Date();
    const expirySoonCutoff = new Date(now);
    expirySoonCutoff.setDate(expirySoonCutoff.getDate() + 30);

    const [
      stores,
      storesWithoutMap,
      floorPlans,
      checkouts,
      spaceStateGroups,
      pdvPhotos,
      promoterPhotoGroups,
      promoterSupplierMembers,
      promoterStoreMembers,
      books,
      booksSent,
      booksReady,
      suppliers,
      brands,
      mediaTypes,
      negotiationTypes,
      storeSectors,
      tradeCatalogs,
      tradeCatalogPages,
      planograms,
      planogramsActive,
      planogramItems,
      negotiations,
      negotiationsClosed,
      negotiatedValue,
      interestsNew,
      negotiationsExpiringSoon,
    ] = await Promise.all([
      prisma.store.count({ where: { organizationId } }),
      prisma.store.count({
        where: { organizationId, floorPlans: { none: {} } },
      }),
      prisma.floorPlan.count({ where: { organizationId } }),
      prisma.mapObject.count({ where: { organizationId, type: "CHECKOUT" } }),
      prisma.mapObject.groupBy({
        by: ["spaceState"],
        where: { organizationId },
        _count: true,
      }),
      prisma.pdvPhoto.count({ where: { organizationId } }),
      prisma.pdvPhoto.groupBy({
        by: ["approvalStatus"],
        where: { organizationId, promoterName: { not: null } },
        _count: true,
      }),
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
      prisma.book.count({ where: { organizationId } }),
      prisma.book.count({ where: { organizationId, sentAt: { not: null } } }),
      prisma.book.count({ where: { organizationId, status: "READY" } }),
      prisma.supplier.count({ where: { organizationId } }),
      prisma.brand.count({ where: { organizationId } }),
      prisma.mediaType.count({ where: { organizationId } }),
      prisma.negotiationType.count({ where: { organizationId } }),
      prisma.storeSector.count({ where: { organizationId } }),
      prisma.tradeCatalog.count({ where: { organizationId } }),
      prisma.tradeCatalogPage.count({
        where: { catalog: { organizationId } },
      }),
      prisma.planogram.count({ where: { organizationId } }),
      prisma.planogram.count({ where: { organizationId, isActive: true } }),
      prisma.planogramItem.count({ where: { organizationId } }),
      prisma.spaceNegotiation.count({ where: { organizationId } }),
      prisma.spaceNegotiation.count({
        where: {
          organizationId,
          status: "FECHADA",
          OR: [{ endDate: null }, { endDate: { gte: now } }],
        },
      }),
      prisma.spaceNegotiation.aggregate({
        where: {
          organizationId,
          status: "FECHADA",
          OR: [{ endDate: null }, { endDate: { gte: now } }],
        },
        _sum: { amount: true },
      }),
      prisma.spaceInterest.count({
        where: { organizationId, status: "NOVO" },
      }),
      prisma.spaceNegotiation.count({
        where: {
          organizationId,
          status: "FECHADA",
          endDate: { gte: now, lte: expirySoonCutoff },
        },
      }),
    ]);

    const stateCount = (state: string) =>
      spaceStateGroups.find((row) => row.spaceState === state)?._count ?? 0;
    const photoCount = (status: string) =>
      promoterPhotoGroups.find((row) => row.approvalStatus === status)
        ?._count ?? 0;
    const promoters = new Set([
      ...promoterSupplierMembers.map((row) => row.memberId),
      ...promoterStoreMembers.map((row) => row.memberId),
    ]).size;

    return {
      stores,
      storesWithoutMap,
      floorPlans,
      checkouts,
      espacosLivre: stateCount("LIVRE"),
      espacosExecutado: stateCount("EXECUTADO"),
      espacosPendente: stateCount("PENDENTE"),
      espacosTotal:
        stateCount("LIVRE") + stateCount("EXECUTADO") + stateCount("PENDENTE"),
      pdvPhotos,
      photosPending: photoCount("PENDING"),
      photosApproved: photoCount("APPROVED"),
      photosRejected: photoCount("REJECTED"),
      promoters,
      books,
      booksSent,
      booksReady,
      suppliers,
      brands,
      mediaTypes,
      negotiationTypes,
      storeSectors,
      tradeCatalogs,
      tradeCatalogPages,
      planograms,
      planogramsActive,
      planogramItems,
      negotiations,
      negotiationsClosed,
      negotiatedValue: negotiatedValue._sum.amount
        ? Number(negotiatedValue._sum.amount)
        : 0,
      interestsNew,
      negotiationsExpiringSoon,
    };
  });
