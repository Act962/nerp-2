import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Lojas do passo 1 do wizard. Mesma visibilidade do `store.list` (todas as
// lojas da org) — quem restringe a captura é o `assertPromoterLink`, não esta
// lista. O que muda aqui é a ordem: os favoritos do promotor sobem ao topo,
// porque ele repete a mesma rota todo dia.
export const listMyStores = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ search: z.string().optional() }))
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
    }),
  )
  .handler(async ({ input, context }) => {
    const member = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { id: true },
    });

    const searchTerm = input.search?.trim();

    const [stores, favorites] = await Promise.all([
      prisma.store.findMany({
        where: {
          organizationId: context.org.id,
          name: searchTerm
            ? { contains: searchTerm, mode: "insensitive" }
            : undefined,
        },
        orderBy: { name: "asc" },
        select: { id: true, name: true, city: true, state: true },
      }),
      member
        ? prisma.promoterFavoriteStore.findMany({
            where: { memberId: member.id, organizationId: context.org.id },
            select: { storeId: true },
          })
        : Promise.resolve([]),
    ]);

    const favoriteIds = new Set(favorites.map((item) => item.storeId));

    return {
      stores: stores
        .map((store) => ({ ...store, isFavorite: favoriteIds.has(store.id) }))
        .sort((a, b) => {
          if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
          return a.name.localeCompare(b.name, "pt-BR");
        }),
    };
  });
