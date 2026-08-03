import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { distanceMeters } from "@/lib/geo-distance";
import { normalizeCity } from "@/lib/store-name";
import { normalizeUf } from "@/lib/uf";
import { z } from "zod";
import { resolveFieldActor } from "./_access";

/** Candidatos lidos de cada fonte antes da ordenação por proximidade. */
const CANDIDATES = 60;
/** Sugestões devolvidas. Uma lista suspensa maior que isto ninguém lê. */
const MAX_RESULTS = 12;

/**
 * Sugestão de lojas enquanto a pessoa digita.
 *
 * **Bate no NOSSO banco, nunca no Nominatim.** A distinção é a regra inteira:
 * a política de uso do Nominatim proíbe autocomplete por tecla, e estourá-la
 * derrubaria junto o reverse-geocode que roda em TODA captura de foto em
 * produção. Por isso a busca de lugares do OpenStreetMap continua só no Enter,
 * num caminho separado (`search-places.ts`), e esta aqui — que consulta o
 * Postgres da própria organização — pode responder a cada tecla à vontade.
 *
 * A ordem é a que quem está em campo espera: primeiro o que está perto, depois
 * o que é da mesma cidade, depois do mesmo estado, e por último o resto. Loja
 * sem posição no mapa não some da lista; ela cai para o degrau da cidade ou do
 * estado, porque quem procura "Carvalho" quer achar o Carvalho mesmo que
 * ninguém tenha fotografado a fachada ainda.
 */
export const searchFieldStores = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      query: z.string().trim().min(2),
      /** Posição de quem procura — sem ela a ordem cai para cidade/estado. */
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
    }),
  )
  .output(
    z.object({
      results: z.array(
        z.object({
          kind: z.enum(["STORE", "DIRECTORY"]),
          id: z.string(),
          name: z.string(),
          city: z.string().nullable(),
          state: z.string().nullable(),
          latitude: z.number().nullable(),
          longitude: z.number().nullable(),
          /** `null` quando falta a posição de um dos dois lados. */
          distanceM: z.number().nullable(),
          /** Por que veio nesta posição da lista — a tela mostra ao usuário. */
          reason: z.enum(["PERTO", "CIDADE", "ESTADO", "OUTRO"]),
        }),
      ),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const actor = await resolveFieldActor(context.org.id, context.user.id);
    if (!actor) {
      throw errors.FORBIDDEN({
        message: "Você não é membro desta organização",
      });
    }

    const byName = {
      name: { contains: input.query, mode: "insensitive" as const },
    };

    const [stores, directory] = await Promise.all([
      // Mesmo recorte do `listMapStores`: quem não é liderança enxerga só a
      // carteira que cobre. A busca não pode ser um atalho para o resto.
      prisma.store.findMany({
        where: {
          organizationId: context.org.id,
          ...(actor.canSeeAll
            ? {}
            : { promoterLinks: { some: { memberId: actor.memberId } } }),
          ...byName,
        },
        orderBy: { name: "asc" },
        take: CANDIDATES,
        select: {
          id: true,
          name: true,
          city: true,
          state: true,
          latitude: true,
          longitude: true,
          osmId: true,
        },
      }),
      prisma.directoryStore.findMany({
        where: byName,
        orderBy: { name: "asc" },
        take: CANDIDATES,
        select: {
          id: true,
          name: true,
          city: true,
          state: true,
          latitude: true,
          longitude: true,
          osmId: true,
        },
      }),
    ]);

    // O mesmo supermercado não pode aparecer duas vezes na mesma lista. Onde a
    // loja da organização e o ponto do catálogo são o mesmo `osmId`, vence a
    // loja: ela é o cliente, e é dela que a pessoa quer o pino.
    const ownedOsmIds = new Set(
      stores
        .map((store) => store.osmId)
        .filter((osmId): osmId is string => Boolean(osmId)),
    );

    const origin =
      input.latitude !== undefined && input.longitude !== undefined
        ? { latitude: input.latitude, longitude: input.longitude }
        : null;
    const city = normalizeCity(input.city ?? "");
    const state = normalizeUf(input.state);

    const candidates = [
      ...stores.map((store) => ({ kind: "STORE" as const, ...store })),
      ...directory
        .filter((point) => !point.osmId || !ownedOsmIds.has(point.osmId))
        .map((point) => ({ kind: "DIRECTORY" as const, ...point })),
    ];

    const results = candidates.map((item) => {
      const distanceM =
        origin && item.latitude !== null && item.longitude !== null
          ? Math.round(
              distanceMeters(origin, {
                latitude: item.latitude,
                longitude: item.longitude,
              }),
            )
          : null;

      const reason =
        distanceM !== null
          ? ("PERTO" as const)
          : city && normalizeCity(item.city ?? "") === city
            ? ("CIDADE" as const)
            : state && normalizeUf(item.state) === state
              ? ("ESTADO" as const)
              : ("OUTRO" as const);

      return {
        kind: item.kind,
        id: item.id,
        name: item.name,
        city: item.city,
        state: item.state,
        latitude: item.latitude,
        longitude: item.longitude,
        distanceM,
        reason,
      };
    });

    const RANK = { PERTO: 0, CIDADE: 1, ESTADO: 2, OUTRO: 3 };

    results.sort((a, b) => {
      if (RANK[a.reason] !== RANK[b.reason]) {
        return RANK[a.reason] - RANK[b.reason];
      }
      if (a.distanceM !== null && b.distanceM !== null) {
        return a.distanceM - b.distanceM;
      }
      return a.name.localeCompare(b.name, "pt-BR");
    });

    return { results: results.slice(0, MAX_RESULTS) };
  });
