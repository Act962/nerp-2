import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Vínculos atuais (indústrias + lojas) de um membro/promotor. Usado na tela de
// gestão para o admin editar. Escopado por org.
export const listMemberLinks = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ memberId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const member = await prisma.member.findFirst({
      where: { id: input.memberId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!member) throw errors.NOT_FOUND({ message: "Membro não encontrado" });

    const [suppliers, stores, distributors] = await Promise.all([
      prisma.promoterSupplier.findMany({
        where: { memberId: member.id },
        select: { supplierId: true },
      }),
      prisma.promoterStore.findMany({
        where: { memberId: member.id },
        select: { storeId: true },
      }),
      prisma.promoterDistributor.findMany({
        where: { memberId: member.id },
        select: { distributorId: true },
      }),
    ]);

    return {
      supplierIds: suppliers.map((row) => row.supplierId),
      storeIds: stores.map((row) => row.storeId),
      distributorIds: distributors.map((row) => row.distributorId),
    };
  });
