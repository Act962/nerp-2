import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { isInBrazil } from "@/lib/brazil-bounds";
import prisma from "@/lib/db";
import { mintStoreSlug } from "@/lib/store-slug";
import { z } from "zod";
import { canManageStores } from "./_can-manage-stores";

const itemSchema = z.object({
  osmId: z
    .string()
    .regex(/^(node|way|relation)\/\d+$/, "Ponto do OSM inválido"),
  name: z.string().trim().min(2).max(140),
  latitude: z.number(),
  longitude: z.number(),
  address: z.string().trim().max(240).nullable(),
  city: z.string().trim().max(120).nullable(),
  state: z.string().trim().max(120).nullable(),
  /**
   * Quando presente, o ponto do OSM é o MESMO cliente que já existe — em vez de
   * criar um segundo cadastro, a coordenada entra no que já está lá.
   */
  linkToStoreId: z.string().nullable().optional(),
});

/**
 * Cria (ou vincula) clientes a partir dos supermercados do OpenStreetMap.
 *
 * Gravar o `osmId` é o que faz a operação ser repetível: varrer de novo a mesma
 * área não gera cliente duplicado, e a lista própria do usuário, importada
 * depois, tem como se juntar a estes em vez de brigar com eles.
 */
export const importOsmStores = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ items: z.array(itemSchema).min(1).max(200) }))
  .output(
    z.object({
      created: z.number(),
      linked: z.number(),
      skipped: z.number(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    if (!(await canManageStores(context.org.id, context.user.id))) {
      throw errors.FORBIDDEN({
        message: "Você não tem permissão para cadastrar clientes",
      });
    }

    const inBrazil = input.items.every((item) =>
      isInBrazil(item.latitude, item.longitude),
    );
    if (!inBrazil) {
      throw errors.BAD_REQUEST({
        message: "Há pontos fora do Brasil na seleção",
      });
    }

    // Os ids de vínculo vêm do cliente e precisam ser reconferidos contra a
    // organização — sem isto dá para escrever no cadastro de outro tenant.
    const linkIds = input.items
      .map((item) => item.linkToStoreId)
      .filter((id): id is string => Boolean(id));

    const linkable = await prisma.store.findMany({
      where: { id: { in: linkIds }, organizationId: context.org.id },
      select: {
        id: true,
        latitude: true,
        address: true,
        city: true,
        state: true,
      },
    });
    const linkableById = new Map(linkable.map((store) => [store.id, store]));

    const taken = await prisma.store.findMany({
      where: {
        organizationId: context.org.id,
        osmId: { in: input.items.map((item) => item.osmId) },
      },
      select: { osmId: true },
    });
    const takenIds = new Set(taken.map((store) => store.osmId));

    // Mapa osmId → ponto do catálogo, para migrar as paradas de rota junto.
    const catalog = await prisma.directoryStore.findMany({
      where: { osmId: { in: input.items.map((item) => item.osmId) } },
      select: { id: true, osmId: true },
    });
    const directoryIdByOsm = new Map(
      catalog.flatMap((point) =>
        point.osmId ? [[point.osmId, point.id] as const] : [],
      ),
    );
    const catalogByOsm = new Map(
      catalog.flatMap((point) =>
        point.osmId ? [[point.osmId, point.id] as const] : [],
      ),
    );

    /**
     * Vira cliente: as paradas de rota que apontavam para o ponto GLOBAL
     * passam a apontar para o cliente. Sem isto o mapa desenha o pino de
     * cliente e a rota continua mostrando o ponto antigo — um fantasma que
     * nunca vira erro.
     */
    const promoteRouteStops = async (osmId: string, storeId: string) => {
      const directoryStoreId = catalogByOsm.get(osmId);
      if (!directoryStoreId) return;
      await prisma.promoterRouteStop.updateMany({
        where: { organizationId: context.org.id, directoryStoreId },
        data: { directoryStoreId: null, storeId },
      });
    };

    let created = 0;
    let linked = 0;
    let skipped = 0;

    for (const item of input.items) {
      if (takenIds.has(item.osmId)) {
        skipped += 1;
        continue;
      }
      takenIds.add(item.osmId);

      const target = item.linkToStoreId
        ? linkableById.get(item.linkToStoreId)
        : undefined;

      if (item.linkToStoreId && !target) {
        skipped += 1;
        continue;
      }

      if (target) {
        // A posição do OSM só entra em cliente que ainda não tem nenhuma. Pino
        // vindo de foto foi o promotor na porta da loja, e ajuste manual foi
        // alguém apontando o dedo — os dois valem mais que o mapa colaborativo.
        await prisma.store.update({
          where: { id: target.id },
          data: {
            osmId: item.osmId,
            directoryStoreId: directoryIdByOsm.get(item.osmId) ?? null,
            ...(target.latitude === null
              ? {
                  latitude: item.latitude,
                  longitude: item.longitude,
                  geoSource: "OSM" as const,
                  geoStatus: "OK" as const,
                  geoPrecision: "osm",
                  geoUpdatedAt: new Date(),
                }
              : {}),
            // Endereço vazio é preenchido; endereço cadastrado é da coordenação.
            ...(target.address ? {} : { address: item.address }),
            ...(target.city ? {} : { city: item.city }),
            ...(target.state ? {} : { state: item.state }),
          },
        });
        await promoteRouteStops(item.osmId, target.id);
        linked += 1;
        continue;
      }

      const store = await prisma.store.create({
        data: {
          organizationId: context.org.id,
          name: item.name,
          address: item.address,
          city: item.city,
          state: item.state,
          osmId: item.osmId,
          // O ponto veio do catálogo: já nasce ligado a ele.
          directoryStoreId: directoryIdByOsm.get(item.osmId) ?? null,
          latitude: item.latitude,
          longitude: item.longitude,
          geoSource: "OSM",
          geoStatus: "OK",
          geoPrecision: "osm",
          geoUpdatedAt: new Date(),
        },
        select: { id: true },
      });
      await mintStoreSlug(store.id, item.name, item.city);
      await promoteRouteStops(item.osmId, store.id);
      created += 1;
    }

    return { created, linked, skipped };
  });
