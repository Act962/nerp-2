import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Indústrias e lojas atuais de um distribuidor (ids), para a tela de gestão.
export const getDistributorRelations = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ distributorId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const distributor = await prisma.distributor.findFirst({
      where: { id: input.distributorId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!distributor)
      throw errors.NOT_FOUND({ message: "Distribuidor não encontrado" });

    const [industries, stores] = await Promise.all([
      prisma.distributorIndustry.findMany({
        where: { distributorId: distributor.id },
        select: { supplierId: true },
      }),
      prisma.storeDistributor.findMany({
        where: { distributorId: distributor.id },
        select: { storeId: true },
      }),
    ]);

    return {
      supplierIds: industries.map((row) => row.supplierId),
      storeIds: stores.map((row) => row.storeId),
    };
  });
