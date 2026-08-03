import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import { distanceMeters } from "@/lib/geo-distance";
import { normalizeStoreName } from "@/lib/store-name";
import { isSuperAdmin } from "@/lib/super-admin";
import { z } from "zod";

/**
 * Fila de conferência do catálogo nacional.
 *
 * O ponto que nasce da foto do promotor entra no mapa NA HORA — é o que faz o
 * catálogo crescer a cada visita. A fila é o contrapeso: alguém confere nome e
 * posição depois, sem travar o campo.
 *
 * `sourceOrgId` é auditoria e só sai aqui, atrás do portão de super-admin:
 * num payload público revelaria onde cada empresa opera.
 */
export const listDirectoryReview = base
  .use(requireAuthMiddleware)
  .input(z.object({ limit: z.number().int().min(1).max(200).default(50) }))
  .output(
    z.object({
      points: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          /** `null` = cadastrado, mas ainda sem pino no mapa. */
          latitude: z.number().nullable(),
          longitude: z.number().nullable(),
          address: z.string().nullable(),
          city: z.string().nullable(),
          state: z.string().nullable(),
          source: z.string(),
          companyName: z.string().nullable(),
          linkedStores: z.number(),
          createdAt: z.string(),
        }),
      ),
      pending: z.number(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    if (!isSuperAdmin(context.user.email)) {
      throw errors.FORBIDDEN({ message: "Fila restrita à administração" });
    }

    const [points, pending] = await Promise.all([
      prisma.directoryStore.findMany({
        where: { reviewedAt: null },
        take: input.limit,
        // Foto de promotor primeiro: é a origem com mais chance de nome torto,
        // e a que mais cresce.
        orderBy: [{ source: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          name: true,
          latitude: true,
          longitude: true,
          address: true,
          city: true,
          state: true,
          source: true,
          createdAt: true,
          company: { select: { name: true } },
          _count: { select: { stores: true } },
        },
      }),
      prisma.directoryStore.count({ where: { reviewedAt: null } }),
    ]);

    return {
      points: points.map((point) => ({
        id: point.id,
        name: point.name,
        latitude: point.latitude,
        longitude: point.longitude,
        address: point.address,
        city: point.city,
        state: point.state,
        source: point.source,
        companyName: point.company?.name ?? null,
        linkedStores: point._count.stores,
        createdAt: point.createdAt.toISOString(),
      })),
      pending,
    };
  });

/** Raio dentro do qual dois pontos de mesmo nome são a mesma loja. */
const NEAR_METERS = 250;

/**
 * Pontos do catálogo que parecem ser a MESMA loja.
 *
 * `resolveDirectoryStore` impede a duplicata nascer, mas não desfaz a que o
 * próprio OpenStreetMap traz: dois `osmId` para o mesmo supermercado (um nó e
 * um polígono, por exemplo). Identidade vence semelhança na escrita — e é o
 * certo —, então esses dois nunca se encontram sozinhos. Quem funde é gente.
 */
export const listDirectoryDuplicates = base
  .use(requireAuthMiddleware)
  .input(z.object({ limit: z.number().int().min(1).max(100).default(30) }))
  .output(
    z.object({
      groups: z.array(
        z.object({
          name: z.string(),
          distanceM: z.number(),
          points: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              osmId: z.string().nullable(),
              city: z.string().nullable(),
              source: z.string(),
              linkedStores: z.number(),
            }),
          ),
        }),
      ),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    if (!isSuperAdmin(context.user.email)) {
      throw errors.FORBIDDEN({ message: "Fila restrita à administração" });
    }

    // Sem coordenada não dá para medir distância — e nome igual sozinho juntaria
    // lojas de cidades diferentes. Esses pontos aparecem na fila de conferência,
    // não aqui.
    const points = await prisma.directoryStore.findMany({
      where: { latitude: { not: null }, longitude: { not: null } },
      select: {
        id: true,
        name: true,
        osmId: true,
        latitude: true,
        longitude: true,
        city: true,
        source: true,
        _count: { select: { stores: true } },
      },
    });

    // Agrupa pelo nome normalizado e só então mede distância: comparar todos
    // contra todos seria quadrático sobre o catálogo inteiro.
    // `{ not: null }` não estreita o tipo no Prisma — o predicado abaixo é o que
    // torna isto seguro sem `!` nem `any`.
    const placed = points.filter(
      (
        point,
      ): point is typeof point & { latitude: number; longitude: number } =>
        point.latitude !== null && point.longitude !== null,
    );

    const byName = new Map<string, typeof placed>();
    for (const point of placed) {
      const key = normalizeStoreName(point.name);
      if (!key) continue;
      const list = byName.get(key);
      if (list) list.push(point);
      else byName.set(key, [point]);
    }

    const groups: {
      name: string;
      distanceM: number;
      points: {
        id: string;
        name: string;
        osmId: string | null;
        city: string | null;
        source: string;
        linkedStores: number;
      }[];
    }[] = [];

    for (const list of byName.values()) {
      if (list.length < 2) continue;
      for (let i = 0; i < list.length && groups.length < input.limit; i += 1) {
        for (let j = i + 1; j < list.length; j += 1) {
          const distance = distanceMeters(list[i], list[j]);
          if (distance > NEAR_METERS) continue;
          groups.push({
            name: list[i].name,
            distanceM: Math.round(distance),
            points: [list[i], list[j]].map((point) => ({
              id: point.id,
              name: point.name,
              osmId: point.osmId,
              city: point.city,
              source: point.source,
              linkedStores: point._count.stores,
            })),
          });
          break;
        }
      }
    }

    return { groups: groups.slice(0, input.limit) };
  });

/**
 * Funde dois pontos do catálogo. O perdedor some; nada de inquilino é perdido.
 *
 * As lojas e as paradas de rota que apontavam para ele passam a apontar para o
 * vencedor — sem isto o `ON DELETE SET NULL` da FK desligaria as lojas do
 * catálogo em silêncio, e elas voltariam a virar pino próprio no mapa público.
 */
export const mergeDirectoryStores = base
  .use(requireAuthMiddleware)
  .input(z.object({ keepId: z.string().min(1), mergeId: z.string().min(1) }))
  .output(z.object({ movedStores: z.number(), movedStops: z.number() }))
  .handler(async ({ input, context, errors }) => {
    if (!isSuperAdmin(context.user.email)) {
      throw errors.FORBIDDEN({ message: "Fusão restrita à administração" });
    }
    if (input.keepId === input.mergeId) {
      throw errors.BAD_REQUEST({ message: "Escolha dois pontos diferentes" });
    }

    const [keep, merge] = await Promise.all([
      prisma.directoryStore.findUnique({
        where: { id: input.keepId },
        select: { id: true },
      }),
      prisma.directoryStore.findUnique({
        where: { id: input.mergeId },
        select: { id: true },
      }),
    ]);
    if (!keep || !merge) {
      throw errors.NOT_FOUND({ message: "Ponto não encontrado" });
    }

    const [stores, stops] = await prisma.$transaction([
      prisma.store.updateMany({
        where: { directoryStoreId: merge.id },
        data: { directoryStoreId: keep.id },
      }),
      prisma.promoterRouteStop.updateMany({
        where: { directoryStoreId: merge.id },
        data: { directoryStoreId: keep.id },
      }),
      prisma.directoryStore.delete({ where: { id: merge.id } }),
      prisma.directoryStore.update({
        where: { id: keep.id },
        data: { reviewedAt: new Date() },
      }),
    ]);

    return { movedStores: stores.count, movedStops: stops.count };
  });

/** Confere (e opcionalmente corrige) um ponto do catálogo. */
export const reviewDirectoryStore = base
  .use(requireAuthMiddleware)
  .input(
    z.object({
      id: z.string().min(1),
      name: z.string().trim().min(2).max(140).optional(),
      city: z.string().trim().max(120).nullable().optional(),
      state: z.string().trim().max(120).nullable().optional(),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    if (!isSuperAdmin(context.user.email)) {
      throw errors.FORBIDDEN({ message: "Fila restrita à administração" });
    }

    const { id, ...fields } = input;
    await prisma.directoryStore.update({
      where: { id },
      data: {
        ...fields,
        reviewedAt: new Date(),
      },
    });
    return { id };
  });
