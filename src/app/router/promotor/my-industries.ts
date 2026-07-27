import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { hasFullAccess } from "@/lib/permissions";
import { z } from "zod";

// Indústrias que o promotor pode fotografar: as vinculadas diretamente
// (PromoterSupplier) OU alcançadas por um distribuidor que ele representa.
// Owner/admin veem todas. Alimenta o passo "Escolha a Indústria" do wizard.
export const listMyIndustries = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ search: z.string().optional() }))
  .handler(async ({ input, context }) => {
    const member = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { id: true, role: true },
    });

    const memberId = member?.id ?? "";
    const searchTerm = input.search?.trim();
    const isAdmin = hasFullAccess(member?.role);

    // AND explícito: busca e acesso têm OR próprios e não podem colidir num spread.
    const filters: Record<string, unknown>[] = [];
    if (searchTerm) {
      filters.push({
        OR: [
          { name: { contains: searchTerm, mode: "insensitive" as const } },
          { tradeName: { contains: searchTerm, mode: "insensitive" as const } },
        ],
      });
    }
    if (!isAdmin) {
      filters.push({
        OR: [
          { promoterLinks: { some: { memberId } } },
          {
            distributorLinks: {
              some: { distributor: { promoterLinks: { some: { memberId } } } },
            },
          },
        ],
      });
    }

    const suppliers = await prisma.supplier.findMany({
      where: {
        organizationId: context.org.id,
        isActive: true,
        ...(filters.length > 0 ? { AND: filters } : {}),
      },
      orderBy: { name: "asc" },
      take: 30,
      select: { id: true, name: true, actionCodeImage: true },
    });

    return {
      suppliers: suppliers.map((supplier) => ({
        id: supplier.id,
        name: supplier.name,
        actionCodeImage: supplier.actionCodeImage,
      })),
    };
  });
