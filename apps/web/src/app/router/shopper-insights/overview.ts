import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Analytics do comportamento do shopper para a indústria. Agrega a mangueira
// ScanEvent (ids denormalizados) na leitura — rollups noturnos são evolução.
export const getShopperInsights = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ days: z.number().int().min(1).max(365).default(30) }))
  .handler(async ({ input, context }) => {
    const organizationId = context.org.id;
    const since = new Date();
    since.setDate(since.getDate() - input.days);
    const scanWindow = { organizationId, createdAt: { gte: since } };

    const [
      scans,
      unknown,
      anonRows,
      favorites,
      couponRedemptions,
      topProductGroups,
      topSupplierGroups,
      topSectorGroups,
      unknownBarcodeGroups,
    ] = await Promise.all([
      prisma.scanEvent.count({
        where: { ...scanWindow, kind: "BARCODE_SCAN" },
      }),
      prisma.scanEvent.count({
        where: { ...scanWindow, kind: "UNKNOWN_BARCODE" },
      }),
      prisma.scanEvent.findMany({
        where: scanWindow,
        distinct: ["anonId"],
        select: { anonId: true },
      }),
      prisma.favorite.count({ where: { organizationId } }),
      prisma.couponRedemption.count({
        where: { coupon: { organizationId }, redeemedAt: { gte: since } },
      }),
      prisma.scanEvent.groupBy({
        by: ["productId"],
        where: {
          ...scanWindow,
          kind: "BARCODE_SCAN",
          productId: { not: null },
        },
        _count: true,
        orderBy: { _count: { productId: "desc" } },
        take: 8,
      }),
      prisma.scanEvent.groupBy({
        by: ["supplierId"],
        where: { ...scanWindow, supplierId: { not: null } },
        _count: true,
        orderBy: { _count: { supplierId: "desc" } },
        take: 8,
      }),
      prisma.scanEvent.groupBy({
        by: ["sectorId"],
        where: { ...scanWindow, kind: "LOCATE", sectorId: { not: null } },
        _count: true,
        orderBy: { _count: { sectorId: "desc" } },
        take: 8,
      }),
      prisma.scanEvent.groupBy({
        by: ["barcode"],
        where: {
          ...scanWindow,
          kind: "UNKNOWN_BARCODE",
          barcode: { not: null },
        },
        _count: true,
        orderBy: { _count: { barcode: "desc" } },
        take: 8,
      }),
    ]);

    const productIds = topProductGroups
      .map((group) => group.productId)
      .filter((id): id is string => id !== null);
    const supplierIds = topSupplierGroups
      .map((group) => group.supplierId)
      .filter((id): id is string => id !== null);
    const sectorIds = topSectorGroups
      .map((group) => group.sectorId)
      .filter((id): id is string => id !== null);

    const [products, suppliers, sectors] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true },
      }),
      prisma.supplier.findMany({
        where: { id: { in: supplierIds } },
        select: { id: true, name: true },
      }),
      prisma.storeSector.findMany({
        where: { id: { in: sectorIds } },
        select: { id: true, name: true },
      }),
    ]);

    const nameOf = (rows: { id: string; name: string }[], id: string | null) =>
      rows.find((row) => row.id === id)?.name ?? "—";

    return {
      days: input.days,
      totals: {
        scans,
        unknown,
        uniqueShoppers: anonRows.length,
        favorites,
        couponRedemptions,
      },
      topProducts: topProductGroups.map((group) => ({
        label: nameOf(products, group.productId),
        value: group._count,
      })),
      topIndustries: topSupplierGroups.map((group) => ({
        label: nameOf(suppliers, group.supplierId),
        value: group._count,
      })),
      topSectors: topSectorGroups.map((group) => ({
        label: nameOf(sectors, group.sectorId),
        value: group._count,
      })),
      catalogGaps: unknownBarcodeGroups.map((group) => ({
        barcode: group.barcode ?? "—",
        value: group._count,
      })),
    };
  });
