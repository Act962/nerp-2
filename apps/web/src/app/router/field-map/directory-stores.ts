import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";
import { matchOsmStore } from "./_osm-match";
import { resolvePublicFaces } from "./_public-face";

/** Teto de pontos devolvidos — o catálogo cresce, a tela não. */
const MAX_POINTS = 600;

/**
 * Varejo conhecido, GLOBAL: aparece para qualquer organização do TradeGram.
 *
 * Não passa por `organizationId` porque não é carteira de ninguém — é o mapa da
 * praça. Os dois recortes por organização são SUBTRAÇÃO e AVISO: ponto que a
 * empresa já cadastrou sai daqui e volta como pino de cliente (senão a mesma
 * loja apareceria duas vezes com dois significados), e ponto parecido com um
 * cliente existente vem marcado para o cadastro não duplicar.
 */
export const listDirectoryStores = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      /**
       * Área visível. Sem ela o catálogo inteiro disputa o mesmo teto e o mapa
       * passa a mostrar 600 pontos de qualquer lugar do país — o que só fica
       * evidente depois de algumas varreduras, quando já parece aleatório.
       */
      south: z.number().min(-90).max(90).optional(),
      west: z.number().min(-180).max(180).optional(),
      north: z.number().min(-90).max(90).optional(),
      east: z.number().min(-180).max(180).optional(),
    }),
  )
  .output(
    z.object({
      points: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          osmId: z.string().nullable(),
          latitude: z.number(),
          longitude: z.number(),
          address: z.string().nullable(),
          suburb: z.string().nullable(),
          city: z.string().nullable(),
          state: z.string().nullable(),
          companyName: z.string().nullable(),
          /** Chave R2 ou caminho de asset da aplicação (`/marcas/...`). */
          logoKey: z.string().nullable(),
          /**
           * Onde este ponto aparece publicamente no TradeGram, quando alguma
           * empresa com perfil público já o tem como cliente.
           */
          public: z
            .object({
              path: z.string(),
              hasFloorPlan: z.boolean(),
              hasPriceScan: z.boolean(),
            })
            .nullable(),
          /** Parece ser um cliente que esta organização já tem cadastrado. */
          duplicateOfStoreId: z.string().nullable(),
          duplicateOfStoreName: z.string().nullable(),
          duplicateReason: z.string().nullable(),
          duplicateDistanceM: z.number().nullable(),
        }),
      ),
      truncated: z.boolean(),
    }),
  )
  .handler(async ({ input, context }) => {
    const hasBox =
      input.south !== undefined &&
      input.north !== undefined &&
      input.west !== undefined &&
      input.east !== undefined;

    const [points, owned] = await Promise.all([
      prisma.directoryStore.findMany({
        take: MAX_POINTS + 1,
        // Ponto sem coordenada existe no catálogo mas não tem pino: entrou pela
        // lista de PDVs e espera a primeira foto do promotor para ser fixado.
        where: hasBox
          ? {
              latitude: { gte: input.south, lte: input.north },
              longitude: { gte: input.west, lte: input.east },
            }
          : { latitude: { not: null }, longitude: { not: null } },
        select: {
          id: true,
          name: true,
          osmId: true,
          latitude: true,
          longitude: true,
          address: true,
          suburb: true,
          city: true,
          state: true,
          logoKey: true,
          company: { select: { name: true, logoKey: true } },
        },
      }),
      prisma.store.findMany({
        where: { organizationId: context.org.id },
        select: {
          id: true,
          name: true,
          latitude: true,
          longitude: true,
          osmId: true,
        },
      }),
    ]);

    const mine = new Set(
      owned.map((store) => store.osmId).filter((id): id is string => !!id),
    );
    // `{ not: null }` não estreita o tipo no Prisma — o predicado é o que torna
    // isto seguro sem `!` nem `any`.
    const visible = points
      .slice(0, MAX_POINTS)
      .filter(
        (
          point,
        ): point is typeof point & { latitude: number; longitude: number } =>
          point.latitude !== null && point.longitude !== null,
      )
      .filter((point) => !(point.osmId && mine.has(point.osmId)));

    // Uma resolução em lote para todos os pontos, não uma por popup: o HTML do
    // popup é montado no `bindPopup`, então dado que chega depois obrigaria a
    // mutar um popup já aberto — botões nascendo sob o cursor.
    const faces = await resolvePublicFaces(
      visible.map((point) => point.osmId).filter((id): id is string => !!id),
    );

    return {
      points: visible.map((point) => {
        const { company, logoKey, ...rest } = point;
        const match = point.osmId
          ? matchOsmStore(
              {
                osmId: point.osmId,
                name: point.name,
                latitude: point.latitude,
                longitude: point.longitude,
              },
              owned,
            )
          : null;
        const duplicate = match?.status === "POSSIVEL_DUPLICADO" ? match : null;

        return {
          ...rest,
          companyName: company?.name ?? null,
          // O override do ponto vence a bandeira da rede.
          logoKey: logoKey ?? company?.logoKey ?? null,
          public: (point.osmId && faces.get(point.osmId)) || null,
          duplicateOfStoreId: duplicate?.storeId ?? null,
          duplicateOfStoreName: duplicate?.storeName ?? null,
          duplicateReason: duplicate?.reason ?? null,
          duplicateDistanceM: duplicate?.distanceM ?? null,
        };
      }),
      truncated: points.length > MAX_POINTS,
    };
  });
