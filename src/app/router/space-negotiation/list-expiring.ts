import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Negociações fechadas cujo término cai dentro da janela escolhida (a partir de
// hoje). Janela por dias/meses/anos — o Painel do Trade usa isto no card
// "Próximo do vencimento".
export const listExpiringNegotiations = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      unit: z.enum(["days", "months", "years"]),
      amount: z.number().int().min(1).max(999),
    }),
  )
  .handler(async ({ input, context }) => {
    const now = new Date();
    const cutoff = new Date(now);
    if (input.unit === "days") cutoff.setDate(cutoff.getDate() + input.amount);
    if (input.unit === "months")
      cutoff.setMonth(cutoff.getMonth() + input.amount);
    if (input.unit === "years")
      cutoff.setFullYear(cutoff.getFullYear() + input.amount);

    const negotiations = await prisma.spaceNegotiation.findMany({
      where: {
        organizationId: context.org.id,
        status: "FECHADA",
        endDate: { gte: now, lte: cutoff },
      },
      orderBy: { endDate: "asc" },
      take: 200,
      select: {
        id: true,
        endDate: true,
        amount: true,
        distributor: true,
        supplier: { select: { name: true } },
        brand: { select: { name: true } },
        negotiationType: { select: { name: true } },
        mapObject: {
          select: {
            id: true,
            name: true,
            spaceCode: true,
            mediaType: { select: { name: true } },
            floorPlan: {
              select: { storeId: true, store: { select: { name: true } } },
            },
          },
        },
      },
    });

    const msPerDay = 1000 * 60 * 60 * 24;
    return negotiations.map((negotiation) => {
      const endDate = negotiation.endDate as Date;
      const daysRemaining = Math.ceil(
        (endDate.getTime() - now.getTime()) / msPerDay,
      );
      return {
        id: negotiation.id,
        endDate: endDate.toISOString(),
        daysRemaining,
        amount: negotiation.amount ? Number(negotiation.amount) : null,
        distributor: negotiation.distributor,
        supplierName: negotiation.supplier?.name ?? null,
        brandName: negotiation.brand?.name ?? null,
        negotiationTypeName: negotiation.negotiationType?.name ?? null,
        storeId: negotiation.mapObject.floorPlan.storeId,
        storeName: negotiation.mapObject.floorPlan.store.name,
        spaceLabel:
          negotiation.mapObject.mediaType?.name ??
          negotiation.mapObject.name ??
          "Espaço",
        spaceCode: negotiation.mapObject.spaceCode,
      };
    });
  });
