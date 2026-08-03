import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import { storePublicPath } from "@/lib/store-slug";
import { z } from "zod";

/**
 * Teto de pontos por consulta.
 *
 * O endpoint é PÚBLICO e não há rate limiting no projeto — este teto e os
 * índices de lat/lng são a defesa inteira contra uma varredura cara repetida.
 */
const MAX_POINTS = 300;

/**
 * Pontos do mapa público do TradeGram.
 *
 * ALLOWLIST explícita, no espírito do `store-map.ts`: cada campo é escolhido a
 * dedo e nada de comercial sai daqui. Nunca devolver `code`, `managerName`,
 * `notes`, `areaM2`, `monthlyCost`, `customersPerDay`, `geoSource`,
 * `geoSampleCount`, `geoQuery`, `geoError`, `osmId` nem `organizationId` — e
 * nunca `...store`.
 *
 * `listMapStores` não serve aqui: exige sessão, organização ativa e recorta por
 * `PromoterStore`. Os três não têm sentido sem usuário.
 */
export const getPublicMapPoints = base
  .route({
    method: "GET",
    summary: "Pontos do mapa público (TradeGram)",
    tags: ["tradegram-public"],
  })
  .input(
    z.object({
      south: z.number().min(-90).max(90),
      west: z.number().min(-180).max(180),
      north: z.number().min(-90).max(90),
      east: z.number().min(-180).max(180),
    }),
  )
  .output(
    z.object({
      points: z.array(
        z.object({
          kind: z.enum(["STORE", "DIRECTORY"]),
          id: z.string(),
          name: z.string(),
          latitude: z.number(),
          longitude: z.number(),
          city: z.string().nullable(),
          state: z.string().nullable(),
          /** Endereço só sai de ponto do OSM — dado público por definição. */
          address: z.string().nullable(),
          logoKey: z.string().nullable(),
          /** `null` = ponto que existe no mapa mas não tem página pública. */
          path: z.string().nullable(),
        }),
      ),
      truncated: z.boolean(),
    }),
  )
  .handler(async ({ input, errors }) => {
    if (input.south >= input.north || input.west >= input.east) {
      throw errors.BAD_REQUEST({ message: "Área do mapa inválida" });
    }

    const box = {
      latitude: { gte: input.south, lte: input.north },
      longitude: { gte: input.west, lte: input.east },
    };

    const stores = await prisma.store.findMany({
      take: MAX_POINTS + 1,
      where: {
        isActive: true,
        organization: { isPublicProfile: true },
        ...box,
      },
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
        city: true,
        state: true,
        coverImageKey: true,
        osmId: true,
        slug: true,
        directoryStoreId: true,
        createdAt: true,
        organization: { select: { slug: true } },
      },
    });

    // O MESMO supermercado é UM ponto, venha de onde vier.
    //
    // A loja ligada ao catálogo NÃO emite ponto próprio: ela empresta o caminho
    // público ao ponto do catálogo, que entra com o nome canônico e a logo da
    // bandeira. É isto que impede duas organizações com o mesmo cliente
    // renderizarem dois pinos no mesmo endereço.
    //
    // Quando várias lojas públicas apontam para o mesmo ponto, vence a mais
    // antiga — determinístico, e não revela quantas nem quais organizações
    // atendem aquele PDV.
    const pathByDirectory = new Map<string, string>();
    for (const store of [...stores].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    )) {
      const orgSlug = store.organization.slug;
      if (!store.directoryStoreId || !orgSlug) continue;
      if (pathByDirectory.has(store.directoryStoreId)) continue;
      pathByDirectory.set(
        store.directoryStoreId,
        storePublicPath(orgSlug, store.id, store.slug),
      );
    }

    // Legado: loja com `osmId` que ainda não passou pela reconciliação. A
    // subtração carrega `isPublicProfile` junto — filtrar só por `osmId`
    // deixaria a loja de uma empresa PRIVADA suprimir em silêncio um ponto do
    // catálogo, um oráculo de existência que se apresenta como nada.
    const claimed = new Set(
      stores
        .filter((store) => !store.directoryStoreId)
        .map((store) => store.osmId)
        .filter((osmId): osmId is string => Boolean(osmId)),
    );

    const directory = await prisma.directoryStore.findMany({
      take: MAX_POINTS + 1,
      where: {
        ...box,
        // Ponto sem coordenada não tem pino: existe no catálogo e espera a
        // primeira foto do promotor.
        latitude: { not: null },
        longitude: { not: null },
        ...(claimed.size > 0 ? { osmId: { notIn: [...claimed] } } : {}),
      },
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
        address: true,
        city: true,
        state: true,
        logoKey: true,
        company: { select: { logoKey: true } },
      },
    });

    const points = [
      ...stores.flatMap((store) => {
        // Já representada pelo ponto do catálogo.
        if (store.directoryStoreId) return [];
        if (store.latitude === null || store.longitude === null) return [];
        const orgSlug = store.organization.slug;
        return [
          {
            kind: "STORE" as const,
            id: store.id,
            name: store.name,
            latitude: store.latitude,
            longitude: store.longitude,
            city: store.city,
            state: store.state,
            // Endereço de cliente é dado do cadastro, não do mapa aberto.
            address: null,
            logoKey: store.coverImageKey,
            path: orgSlug
              ? storePublicPath(orgSlug, store.id, store.slug)
              : null,
          },
        ];
      }),
      ...directory.flatMap((point) => {
        if (point.latitude === null || point.longitude === null) return [];
        return [
          {
            // Ponto do catálogo com loja pública ligada continua sendo do catálogo:
            // o nome canônico é dele, e o caminho é emprestado.
            kind: (pathByDirectory.has(point.id) ? "STORE" : "DIRECTORY") as
              | "STORE"
              | "DIRECTORY",
            id: point.id,
            name: point.name,
            latitude: point.latitude,
            longitude: point.longitude,
            city: point.city,
            state: point.state,
            address: point.address,
            logoKey: point.logoKey ?? point.company?.logoKey ?? null,
            path: pathByDirectory.get(point.id) ?? null,
          },
        ];
      }),
    ];

    return {
      points: points.slice(0, MAX_POINTS),
      truncated:
        stores.length > MAX_POINTS ||
        directory.length > MAX_POINTS ||
        points.length > MAX_POINTS,
    };
  });
