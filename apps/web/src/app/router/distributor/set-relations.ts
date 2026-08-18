import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { hasFullAccess } from "@/lib/permissions";
import { z } from "zod";

// Substitui as indústrias e lojas de um distribuidor. Só owner/admin. Valida
// que cada id pertence à org antes de gravar (evita id forjado).
export const setDistributorRelations = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      distributorId: z.string(),
      supplierIds: z.array(z.string()),
      storeIds: z.array(z.string()),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const actor = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { role: true },
    });
    if (!hasFullAccess(actor?.role)) {
      throw errors.FORBIDDEN({ message: "Sem permissão para editar vínculos" });
    }

    const distributor = await prisma.distributor.findFirst({
      where: { id: input.distributorId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!distributor)
      throw errors.NOT_FOUND({ message: "Distribuidor não encontrado" });

    const [validSuppliers, validStores] = await Promise.all([
      prisma.supplier.findMany({
        where: {
          organizationId: context.org.id,
          id: { in: input.supplierIds },
        },
        select: { id: true },
      }),
      prisma.store.findMany({
        where: { organizationId: context.org.id, id: { in: input.storeIds } },
        select: { id: true },
      }),
    ]);

    await prisma.$transaction([
      prisma.distributorIndustry.deleteMany({
        where: { distributorId: distributor.id },
      }),
      prisma.storeDistributor.deleteMany({
        where: { distributorId: distributor.id },
      }),
      prisma.distributorIndustry.createMany({
        data: validSuppliers.map((supplier) => ({
          organizationId: context.org.id,
          distributorId: distributor.id,
          supplierId: supplier.id,
        })),
      }),
      prisma.storeDistributor.createMany({
        data: validStores.map((store) => ({
          organizationId: context.org.id,
          distributorId: distributor.id,
          storeId: store.id,
        })),
      }),
    ]);

    return {
      supplierIds: validSuppliers.map((row) => row.id),
      storeIds: validStores.map((row) => row.id),
    };
  });
