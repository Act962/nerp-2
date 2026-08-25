import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Histórico de negociações de um espaço, mais recente primeiro.
export const listSpaceNegotiations = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ mapObjectId: z.string() }))
  .handler(async ({ input, context }) => {
    const negotiations = await prisma.spaceNegotiation.findMany({
      where: {
        mapObjectId: input.mapObjectId,
        organizationId: context.org.id,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        supplierId: true,
        brandId: true,
        negotiationTypeId: true,
        distributor: true,
        startDate: true,
        endDate: true,
        amount: true,
        status: true,
        notes: true,
        createdAt: true,
        supplier: { select: { name: true } },
        brand: { select: { name: true } },
        negotiationType: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    });

    return negotiations.map((negotiation) => ({
      id: negotiation.id,
      supplierId: negotiation.supplierId,
      supplierName: negotiation.supplier?.name ?? null,
      brandId: negotiation.brandId,
      brandName: negotiation.brand?.name ?? null,
      negotiationTypeId: negotiation.negotiationTypeId,
      negotiationTypeName: negotiation.negotiationType?.name ?? null,
      distributor: negotiation.distributor,
      startDate: negotiation.startDate?.toISOString() ?? null,
      endDate: negotiation.endDate?.toISOString() ?? null,
      amount: negotiation.amount ? Number(negotiation.amount) : null,
      status: negotiation.status,
      notes: negotiation.notes,
      createdAt: negotiation.createdAt.toISOString(),
      createdByName: negotiation.createdBy.name,
    }));
  });
