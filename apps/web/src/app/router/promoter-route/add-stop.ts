import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";
import { resolveRoute, routableStoreWhere } from "./_access";

/** Teto de paradas. Acima disto o 2-opt fica caro e a rota deixa de ser um dia. */
const MAX_STOPS = 120;

export const addRouteStop = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z
      .object({
        storeId: z.string().optional(),
        directoryStoreId: z.string().optional(),
      })
      // Espelha o CHECK do banco: o Prisma não conhece a restrição, então sem
      // isto o usuário receberia um erro cru do Postgres em vez de uma frase.
      .refine(
        (input) => Boolean(input.storeId) !== Boolean(input.directoryStoreId),
        "Informe um cliente OU um ponto do catálogo",
      ),
  )
  .output(z.object({ stopId: z.string(), position: z.number() }))
  .handler(async ({ input, context, errors }) => {
    const actor = await resolveRoute(context.org.id, context.user.id);
    if (!actor) {
      throw errors.FORBIDDEN({
        message: "Você não é membro desta organização",
      });
    }

    const [count, last] = await Promise.all([
      prisma.promoterRouteStop.count({ where: { routeId: actor.routeId } }),
      prisma.promoterRouteStop.findFirst({
        where: { routeId: actor.routeId },
        orderBy: { position: "desc" },
        select: { position: true },
      }),
    ]);
    if (count >= MAX_STOPS) {
      throw errors.BAD_REQUEST({
        message: `Uma rota comporta até ${MAX_STOPS} paradas`,
      });
    }

    let name: string;
    let latitude: number;
    let longitude: number;

    if (input.storeId) {
      // Quem não é liderança só roteiriza o que cobre — o MESMO recorte do
      // mapa. Sem isto o endpoint desfaz o escopo em silêncio e vira um jeito
      // de enumerar a carteira inteira da organização.
      const store = await prisma.store.findFirst({
        where: {
          ...routableStoreWhere(actor, context.org.id),
          id: input.storeId,
        },
        select: { name: true, latitude: true, longitude: true },
      });
      if (!store) {
        throw errors.NOT_FOUND({ message: "Cliente não encontrado" });
      }
      if (store.latitude === null || store.longitude === null) {
        throw errors.BAD_REQUEST({
          message: "Este cliente ainda não tem posição no mapa",
        });
      }
      name = store.name;
      latitude = store.latitude;
      longitude = store.longitude;
    } else {
      // Linha GLOBAL: buscada sem filtro de organização, e está certo. A
      // fronteira de inquilino é a rota, não o alvo.
      const point = await prisma.directoryStore.findUnique({
        where: { id: input.directoryStoreId },
        select: { name: true, latitude: true, longitude: true, osmId: true },
      });
      if (!point) {
        throw errors.NOT_FOUND({ message: "Ponto não encontrado" });
      }
      if (point.latitude === null || point.longitude === null) {
        throw errors.BAD_REQUEST({
          message:
            "Este ponto ainda não tem posição no mapa. A primeira foto de um promotor fixa o pino.",
        });
      }
      if (point.osmId) {
        const owned = await prisma.store.findFirst({
          where: { organizationId: context.org.id, osmId: point.osmId },
          select: { id: true },
        });
        if (owned) {
          throw errors.BAD_REQUEST({
            message:
              "Este ponto já é seu cliente — adicione a rota pelo pino do cliente",
          });
        }
      }
      name = point.name;
      latitude = point.latitude;
      longitude = point.longitude;
    }

    const stop = await prisma.promoterRouteStop.create({
      data: {
        organizationId: context.org.id,
        routeId: actor.routeId,
        position: (last?.position ?? -1) + 1,
        storeId: input.storeId ?? null,
        directoryStoreId: input.directoryStoreId ?? null,
        name,
        latitude,
        longitude,
      },
      select: { id: true, position: true },
    });

    return { stopId: stop.id, position: stop.position };
  });
