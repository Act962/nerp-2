import { base } from "@/app/middlewares/base";
import { readFixtureProps } from "@/features/store-map/engine/fixture-catalog";
import prisma from "@/lib/db";
import { z } from "zod";

// Página pública de uma loja (TradeGram): quadros por tipo de mídia. Mesmo gate
// de opt-in do feed do grupo, e valida que a loja pertence à org pública.
export const getPublicStore = base
  .route({
    method: "GET",
    summary: "Loja pública (TradeGram)",
    tags: ["tradegram-public"],
  })
  .input(z.object({ orgSlug: z.string().min(1), storeId: z.string().min(1) }))
  .handler(async ({ input, errors }) => {
    const org = await prisma.organization.findUnique({
      where: { slug: input.orgSlug },
      select: { id: true, slug: true, isPublicProfile: true },
    });
    if (!org || !org.isPublicProfile) {
      throw errors.NOT_FOUND({ message: "Perfil não encontrado" });
    }

    const store = await prisma.store.findFirst({
      where: { id: input.storeId, organizationId: org.id, isActive: true },
      select: { id: true, name: true, code: true, city: true, state: true },
    });
    if (!store) throw errors.NOT_FOUND({ message: "Loja não encontrada" });

    // Espaços da loja (via floorPlan.storeId) — os campos mínimos para os
    // números; nada de valores comerciais.
    const objects = await prisma.mapObject.findMany({
      where: {
        organizationId: org.id,
        floorPlan: { storeId: store.id },
        OR: [
          { type: { in: ["GONDOLA", "ISLAND", "CHECKOUT", "PIN"] } },
          { mediaTypeId: { not: null } },
        ],
      },
      select: {
        supplierId: true,
        mediaTypeId: true,
        updatedAt: true,
        properties: true,
      },
    });

    // Contagem POR PRATELEIRA (em sintonia com o "3/6" do mapa): cada gôndola
    // soma suas prateleiras negociadas/total (de `properties.fixture`). Espaços
    // sem mobiliário (checkout/pin) não têm prateleira e somam zero.
    let negociados = 0; // prateleiras negociadas na loja
    let naoNegociados = 0; // prateleiras disponíveis (total - negociadas)
    const supplierIds = new Set<string>();
    const byMedia = new Map<
      string,
      { total: number; negociados: number; lastModified: Date | null }
    >();

    for (const object of objects) {
      const fixture = readFixtureProps(
        object.properties as Record<string, unknown> | null,
      );
      const shelfTotal = fixture?.shelfCount ?? 0;
      const shelfNegotiated = fixture?.negotiatedShelves ?? 0;
      negociados += shelfNegotiated;
      naoNegociados += Math.max(0, shelfTotal - shelfNegotiated);
      if (object.supplierId) supplierIds.add(object.supplierId);
      if (object.mediaTypeId) {
        const bucket = byMedia.get(object.mediaTypeId) ?? {
          total: 0,
          negociados: 0,
          lastModified: null,
        };
        bucket.total += shelfTotal;
        bucket.negociados += shelfNegotiated;
        if (!bucket.lastModified || object.updatedAt > bucket.lastModified) {
          bucket.lastModified = object.updatedAt;
        }
        byMedia.set(object.mediaTypeId, bucket);
      }
    }

    // Todos os tipos de mídia da org aparecem, mesmo sem espaço cadastrado.
    const mediaTypes = await prisma.mediaType.findMany({
      where: { organizationId: org.id, isActive: true },
      select: { id: true, code: true, name: true, defaultPhotos: true },
    });

    const EMPTY = {
      total: 0,
      negociados: 0,
      lastModified: null as Date | null,
    };

    const mediaTiles = mediaTypes
      .map((mediaType) => ({
        mediaType,
        counts: byMedia.get(mediaType.id) ?? EMPTY,
      }))
      // Ativos (com espaço EXECUTADO) primeiro; dentro de cada grupo, os
      // modificados por último no topo. Sem contrato ativo cai para o fim.
      .sort((first, second) => {
        const firstActive = first.counts.negociados > 0;
        const secondActive = second.counts.negociados > 0;
        if (firstActive !== secondActive) return firstActive ? -1 : 1;
        const firstTime = first.counts.lastModified?.getTime() ?? 0;
        const secondTime = second.counts.lastModified?.getTime() ?? 0;
        return secondTime - firstTime;
      })
      .map(({ mediaType, counts }) => ({
        code: mediaType.code,
        name: mediaType.name,
        photoKey: mediaType.defaultPhotos[0] ?? null,
        // countA = prateleiras negociadas; countB = total de prateleiras.
        countA: counts.negociados,
        countB: counts.total,
        active: counts.negociados > 0,
      }));

    return {
      header: {
        name: store.name,
        city: store.city,
        state: store.state,
        handle: store.code ? `${org.slug}-lj-${store.code}` : org.slug,
      },
      stats: { negociados, naoNegociados, industrias: supplierIds.size },
      mediaTiles,
    };
  });
