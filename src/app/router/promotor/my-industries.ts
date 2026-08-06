import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { hasFullAccess } from "@/lib/permissions";
import { z } from "zod";

const PAGE_SIZE = 30;

// Indústrias que o promotor pode fotografar: as vinculadas diretamente
// (PromoterSupplier) OU alcançadas por um distribuidor que ele representa.
// Owner/admin veem todas. Alimenta o passo "Escolha a Indústria" do wizard.
// Cursor puro (sem count), mesmo racional do `myStores`.
export const listMyIndustries = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      search: z.string().optional(),
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(60).optional(),
    }),
  )
  .output(
    z.object({
      suppliers: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          actionCodeImage: z.string().nullable(),
          isFavorite: z.boolean(),
        }),
      ),
      nextCursor: z.string().nullable(),
    }),
  )
  .handler(async ({ input, context }) => {
    const limit = input.limit ?? PAGE_SIZE;
    const isFirstPage = !input.cursor;

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

    // Favoritos vêm numa consulta própria, à parte do cursor, e só na
    // primeira página: a indústria favorita do promotor pode estar no fim do
    // alfabeto e sumiria do corte por página, justo a que ele mais usa.
    const favoriteIds =
      isFirstPage && memberId
        ? (
            await prisma.promoterFavoriteSupplier.findMany({
              where: { memberId, organizationId: context.org.id },
              select: { supplierId: true },
            })
          ).map((item) => item.supplierId)
        : [];

    const select = { id: true, name: true, actionCodeImage: true };
    const [favorites, rows] = await Promise.all([
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
        take: limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        select,
      }),
    ]);

    const hasMore = rows.length > limit;
    const others = hasMore ? rows.slice(0, limit) : rows;

    return {
      suppliers: [
        ...favorites.map((supplier) => ({ ...supplier, isFavorite: true })),
        ...others.map((supplier) => ({ ...supplier, isFavorite: false })),
      ],
      nextCursor: hasMore ? others[others.length - 1]?.id : null,
    };
  });
