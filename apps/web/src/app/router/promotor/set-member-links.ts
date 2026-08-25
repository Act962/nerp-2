import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { hasFullAccess } from "@/lib/permissions";
import { z } from "zod";

// Substitui os vínculos de um membro/promotor: indústrias + lojas (direto) e
// distribuidores (via grafo). Só owner/admin. Valida que cada id pertence à org
// antes de gravar.
export const setMemberLinks = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      memberId: z.string(),
      supplierIds: z.array(z.string()),
      storeIds: z.array(z.string()),
      distributorIds: z.array(z.string()).optional(),
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

    const member = await prisma.member.findFirst({
      where: { id: input.memberId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!member) throw errors.NOT_FOUND({ message: "Membro não encontrado" });

    // Só ids que realmente pertencem à org entram (evita id forjado).
    const [validSuppliers, validStores, validDistributors] = await Promise.all([
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
      prisma.distributor.findMany({
        where: {
          organizationId: context.org.id,
          id: { in: input.distributorIds ?? [] },
        },
        select: { id: true },
      }),
    ]);

    await prisma.$transaction([
      prisma.promoterSupplier.deleteMany({ where: { memberId: member.id } }),
      prisma.promoterStore.deleteMany({ where: { memberId: member.id } }),
      prisma.promoterDistributor.deleteMany({ where: { memberId: member.id } }),
      prisma.promoterSupplier.createMany({
        data: validSuppliers.map((supplier) => ({
          organizationId: context.org.id,
          memberId: member.id,
          supplierId: supplier.id,
        })),
      }),
      prisma.promoterStore.createMany({
        data: validStores.map((store) => ({
          organizationId: context.org.id,
          memberId: member.id,
          storeId: store.id,
        })),
      }),
      prisma.promoterDistributor.createMany({
        data: validDistributors.map((distributor) => ({
          organizationId: context.org.id,
          memberId: member.id,
          distributorId: distributor.id,
        })),
      }),
    ]);

    return {
      supplierIds: validSuppliers.map((row) => row.id),
      storeIds: validStores.map((row) => row.id),
      distributorIds: validDistributors.map((row) => row.id),
    };
  });
