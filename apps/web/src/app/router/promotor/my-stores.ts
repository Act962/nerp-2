import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

const PAGE_SIZE = 30;

// Lojas do passo 1 do wizard. Mesma visibilidade do `store.list` (todas as
// lojas da org): qualquer membro captura em qualquer loja da própria
// organização — o escopo é a org, não um vínculo por promotor. Cursor puro
// (sem count): a lista roda em orgs com milhares de lojas e contar a cada
// tecla travaria a busca, igual ao seletor de produto do planograma.
export const listMyStores = base
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
      stores: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          city: z.string().nullable(),
          state: z.string().nullable(),
          isFavorite: z.boolean(),
        }),
      ),
      nextCursor: z.string().nullable(),
    }),
  )
  .handler(async ({ input, context }) => {
    const limit = input.limit ?? PAGE_SIZE;
    const searchTerm = input.search?.trim();
    const isFirstPage = !input.cursor;

    const member = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { id: true },
    });

    const where = {
      organizationId: context.org.id,
      name: searchTerm
        ? { contains: searchTerm, mode: "insensitive" as const }
        : undefined,
    };

    // Favoritos vêm numa consulta própria, à parte do cursor, e só na primeira
    // página: a loja favorita do promotor pode estar no fim do alfabeto e
    // sumiria do corte por página, justo a que ele mais usa. Nas páginas
    // seguintes eles já apareceram, então some do resultado.
    const favoriteIds =
      isFirstPage && member
        ? (
            await prisma.promoterFavoriteStore.findMany({
              where: { memberId: member.id, organizationId: context.org.id },
              select: { storeId: true },
            })
          ).map((item) => item.storeId)
        : [];

    const [favorites, rows] = await Promise.all([
      favoriteIds.length > 0
        ? prisma.store.findMany({
            where: { AND: [where, { id: { in: favoriteIds } }] },
            orderBy: { name: "asc" },
            select: { id: true, name: true, city: true, state: true },
          })
        : Promise.resolve([]),
      prisma.store.findMany({
        where:
          favoriteIds.length > 0
            ? { AND: [where, { id: { notIn: favoriteIds } }] }
            : where,
        orderBy: { name: "asc" },
        take: limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        select: { id: true, name: true, city: true, state: true },
      }),
    ]);

    const hasMore = rows.length > limit;
    const others = hasMore ? rows.slice(0, limit) : rows;

    return {
      stores: [
        ...favorites.map((store) => ({ ...store, isFavorite: true })),
        ...others.map((store) => ({ ...store, isFavorite: false })),
      ],
      nextCursor: hasMore ? others[others.length - 1]?.id : null,
    };
  });
