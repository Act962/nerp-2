import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";
import { resolveRoute, routableStoreWhere } from "./_access";

const MAX_RESULTS = 40;

/**
 * Clientes que o promotor pode colocar na rota, do celular.
 *
 * Duas exigências que não são detalhe:
 *
 * 1. **Mesma visibilidade do `add-stop`**, pelo `routableStoreWhere`. Listar
 *    mais do que a escrita aceita seria oferecer um cliente e recusá-lo no
 *    toque seguinte.
 * 2. **Só quem tem posição no mapa.** Uma parada guarda latitude e longitude
 *    obrigatórias; sem o filtro, o cliente sem pino apareceria na busca e o
 *    servidor responderia "ainda não tem posição no mapa" — informação certa
 *    na hora errada, quando a pessoa já está na porta da loja.
 */
export const listRoutableStores = base
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
          /** Já está na rota — o app mostra como adicionado em vez de repetir. */
          inRoute: z.boolean(),
        }),
      ),
      /** Clientes atendidos que ainda não têm pino, para a tela poder explicar. */
      withoutPosition: z.number(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const actor = await resolveRoute(context.org.id, context.user.id);
    if (!actor) {
      throw errors.FORBIDDEN({
        message: "Você não é membro desta organização",
      });
    }

    const visible = routableStoreWhere(actor, context.org.id);
    const search = input.search?.trim();
    const byName = search
      ? { name: { contains: search, mode: "insensitive" as const } }
      : {};

    const [stores, withoutPosition, stops] = await Promise.all([
      prisma.store.findMany({
        where: {
          ...visible,
          ...byName,
          latitude: { not: null },
          longitude: { not: null },
        },
        orderBy: { name: "asc" },
        take: MAX_RESULTS,
        select: { id: true, name: true, city: true, state: true },
      }),
      prisma.store.count({
        where: { ...visible, OR: [{ latitude: null }, { longitude: null }] },
      }),
      prisma.promoterRouteStop.findMany({
        where: { routeId: actor.routeId, storeId: { not: null } },
        select: { storeId: true },
      }),
    ]);

    const inRoute = new Set(stops.map((stop) => stop.storeId));

    return {
      stores: stores.map((store) => ({
        ...store,
        inRoute: inRoute.has(store.id),
      })),
      withoutPosition,
    };
  });
