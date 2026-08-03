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

    const where = {
      organizationId: context.org.id,
      isActive: true,
      ...(filters.length > 0 ? { AND: filters } : {}),
    };

    // Favoritos vêm numa consulta própria, não do `take: 30` da lista: a
    // indústria favorita do promotor pode estar no fim do alfabeto e sumiria
    // do corte, justo a que ele mais usa.
    const favoriteIds = memberId
      ? (
          await prisma.promoterFavoriteSupplier.findMany({
            where: { memberId, organizationId: context.org.id },
            select: { supplierId: true },
          })
        ).map((item) => item.supplierId)
      : [];

    const select = { id: true, name: true, actionCodeImage: true };
    const [favorites, others] = await Promise.all([
      favoriteIds.length > 0
        ? prisma.supplier.findMany({
            where: { AND: [where, { id: { in: favoriteIds } }] },
            orderBy: { name: "asc" },
            select,
          })
        : Promise.resolve([]),
      prisma.supplier.findMany({
        where:
          favoriteIds.length > 0
            ? { AND: [where, { id: { notIn: favoriteIds } }] }
            : where,
        orderBy: { name: "asc" },
        take: 30,
        select,
      }),
    ]);

    return {
      suppliers: [
        ...favorites.map((supplier) => ({ ...supplier, isFavorite: true })),
        ...others.map((supplier) => ({ ...supplier, isFavorite: false })),
      ],
    };
  });
