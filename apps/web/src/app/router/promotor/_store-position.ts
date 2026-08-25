import prisma from "@/lib/db";
import { resolveDirectoryStore } from "../field-map/_resolve-directory-store";

/** Quantas fotos entram no cálculo. Recentes bastam — a loja não se move. */
const SAMPLE_SIZE = 30;

/** Abaixo disto a tela marca o pino como aproximado. */
export const RELIABLE_SAMPLES = 3;

/** Raio em torno da captura mais recente que ainda conta como "a mesma loja". */
const CLUSTER_RADIUS_KM = 1;

/**
 * Mediana, não média.
 *
 * A foto tirada no estacionamento, ou com o GPS ainda travado no caminho,
 * desloca a média e NÃO move a mediana.
 */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

/** Distância aproximada em km. Equirretangular basta nesta escala. */
function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = Math.PI / 180;
  const x = (b.lng - a.lng) * toRad * Math.cos(((a.lat + b.lat) / 2) * toRad);
  const y = (b.lat - a.lat) * toRad;
  return Math.sqrt(x * x + y * y) * 6371;
}

/**
 * Pontos que representam a loja: os que estão a até 1 km da captura MAIS
 * RECENTE, com a mediana entre eles.
 *
 * A âncora na captura recente não é detalhe. Sem ela, uma loja fotografada de
 * dois lugares distantes — a visita de verdade e uma foto de teste feita em
 * casa — teria a mediana caindo no meio do caminho, num ponto onde a loja não
 * está e que ninguém consegue explicar olhando o mapa. A foto mais nova é a
 * melhor âncora isolada; a mediana das vizinhas refina.
 */
function clusterAroundLatest(points: { lat: number; lng: number }[]): {
  latitude: number;
  longitude: number;
  used: number;
} {
  // O chamador passa em ordem decrescente de data — a primeira é a mais recente.
  const anchor = points[0];
  const near = points.filter(
    (point) => distanceKm(anchor, point) <= CLUSTER_RADIUS_KM,
  );

  return {
    latitude: median(near.map((point) => point.lat)),
    longitude: median(near.map((point) => point.lng)),
    used: near.length,
  };
}

interface CapturedPlace {
  road: string | null;
  houseNumber: string | null;
  suburb: string | null;
  city: string | null;
  state: string | null;
  label: string | null;
}

/**
 * Recalcula a posição da loja a partir das fotos tiradas nela.
 *
 * O promotor está fisicamente na porta quando fotografa — essa coordenada vale
 * mais do que geocodificar endereço em texto livre. A primeira foto já grava,
 * para o mapa se povoar de imediato, e o pino melhora sozinho a cada visita.
 *
 * Nunca lança: o promotor está em 4G dentro do supermercado e a foto é o que
 * importa. Falhar aqui não pode custar a captura.
 */
export async function refreshStorePositionFromPhotos(params: {
  organizationId: string;
  storeId: string;
  place?: CapturedPlace | null;
}): Promise<void> {
  const { organizationId, storeId, place } = params;

  try {
    const store = await prisma.store.findFirst({
      where: { id: storeId, organizationId },
      select: {
        id: true,
        name: true,
        geoSource: true,
        address: true,
        city: true,
        state: true,
        directoryStoreId: true,
      },
    });
    if (!store) return;

    // Pino ajustado à mão é decisão de gente: nada automático o sobrescreve.
    if (store.geoSource === "MANUAL") return;

    const photos = await prisma.pdvPhoto.findMany({
      where: {
        organizationId,
        storeId,
        // Foto marcada "fora do local" nunca entra no cálculo do pino.
        offSite: false,
        capturedLatitude: { not: null },
        capturedLongitude: { not: null },
      },
      orderBy: { capturedAt: "desc" },
      take: SAMPLE_SIZE,
      select: { capturedLatitude: true, capturedLongitude: true },
    });

    // `{ not: null }` não estreita o tipo no Prisma — o predicado abaixo é o que
    // torna isso seguro sem `!` nem `any`.
    const points = photos.filter(
      (
        photo,
      ): photo is { capturedLatitude: number; capturedLongitude: number } =>
        photo.capturedLatitude !== null && photo.capturedLongitude !== null,
    );
    if (points.length === 0) return;

    const cluster = clusterAroundLatest(
      points.map((point) => ({
        lat: point.capturedLatitude,
        lng: point.capturedLongitude,
      })),
    );

    // Endereço só quando está VAZIO. Reescrever em silêncio o que a coordenação
    // cadastrou seria tomar a caneta da mão dela.
    const street =
      place?.road && place.houseNumber
        ? `${place.road}, ${place.houseNumber}`
        : (place?.road ?? null);

    await prisma.store.update({
      where: { id: store.id },
      data: {
        latitude: cluster.latitude,
        longitude: cluster.longitude,
        geoSource: "FOTO",
        geoStatus: "OK",
        // Conta as fotos que de fato sustentam o pino, não todas as do período:
        // dizer "12 fotos" quando 10 foram descartadas por estarem longe seria
        // vender uma confiança que o dado não tem.
        geoSampleCount: cluster.used,
        geoPrecision:
          cluster.used >= RELIABLE_SAMPLES ? "gps-foto" : "gps-foto-1",
        geoUpdatedAt: new Date(),
        geoError: null,
        ...(store.address?.trim() ? {} : street ? { address: street } : {}),
        ...(store.city?.trim() ? {} : place?.city ? { city: place.city } : {}),
        ...(store.state?.trim()
          ? {}
          : place?.state
            ? { state: place.state }
            : {}),
      },
    });

    // O promotor é a máquina de cadastro do catálogo nacional: ele está na
    // porta da loja quando fotografa, então esta é a coordenada mais confiável
    // que o sistema jamais terá daquele ponto. Uma visita basta para o
    // supermercado passar a existir no mapa do Brasil — faltando só a logo.
    if (store.directoryStoreId) {
      // O ponto já existe no catálogo — provavelmente veio de uma lista de PDVs,
      // com endereço e SEM coordenada. Esta é a foto que fixa o pino: o promotor
      // está na porta da loja, e é a posição mais confiável que o sistema terá.
      // `updateMany` com `latitude: null` no filtro é o que torna isto seguro
      // sem transação: quem já tem pino nunca é movido por uma foto.
      await prisma.directoryStore.updateMany({
        where: { id: store.directoryStoreId, latitude: null },
        data: {
          latitude: cluster.latitude,
          longitude: cluster.longitude,
          ...(street ? { address: street } : {}),
          ...(place?.suburb ? { suburb: place.suburb } : {}),
          ...(place?.city ? { city: place.city } : {}),
          ...(place?.state ? { state: place.state } : {}),
        },
      });
      return;
    }

    const resolved = await resolveDirectoryStore({
      name: store.name,
      latitude: cluster.latitude,
      longitude: cluster.longitude,
      address: store.address?.trim() || street,
      suburb: place?.suburb ?? null,
      city: store.city?.trim() || place?.city || null,
      state: store.state?.trim() || place?.state || null,
      source: "PROMOTOR",
      sourceOrgId: organizationId,
    });
    if (resolved) {
      await prisma.store.update({
        where: { id: store.id },
        data: { directoryStoreId: resolved.id },
      });
    }
  } catch {
    // Silencioso de propósito — ver comentário do topo.
  }
}
