import { z } from "zod";

export const GEO_SOURCES = [
  "FOTO",
  "MANUAL",
  "IMPORTED",
  "GEOCODED",
  "OSM",
] as const;
export const GEO_STATUSES = [
  "PENDING",
  "QUEUED",
  "OK",
  "NOT_FOUND",
  "FAILED",
] as const;

/** Abaixo disto a tela marca o pino como aproximado. */
export const RELIABLE_SAMPLES = 3;

export const mapStoreSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  latitude: z.number(),
  longitude: z.number(),
  geoSource: z.enum(GEO_SOURCES),
  geoSampleCount: z.number(),
  /** Chave R2 da foto de fachada — vira a arte do pino quando existe. */
  coverImageKey: z.string().nullable(),
  /** Pino confiável o bastante para não avisar o usuário. */
  isReliable: z.boolean(),
  /**
   * Presença desta loja no TradeGram público. `null` quando a empresa não tem
   * perfil público ou a loja está inativa — nesses casos não existe página para
   * onde mandar ninguém.
   */
  public: z
    .object({
      path: z.string(),
      hasFloorPlan: z.boolean(),
      hasPriceScan: z.boolean(),
    })
    .nullable(),
});

export const offMapStoreSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  geoStatus: z.enum(GEO_STATUSES),
  geoError: z.string().nullable(),
});

/**
 * `kind` já nasce com os três valores e só `FOTO` é produzido hoje.
 *
 * Quando o check-in existir, é uma tabela nova e um segundo `findMany` fundido
 * neste mesmo array — **zero mudança no cliente**. É também a porta por onde a
 * posição do app de logística entra depois.
 */
export const TRAIL_POINT_KINDS = ["FOTO", "CHECKIN", "CHECKOUT"] as const;

export const trailPointSchema = z.object({
  /** Prefixado pela fonte ("foto:<id>") para a key do React nunca colidir. */
  id: z.string(),
  kind: z.enum(TRAIL_POINT_KINDS),
  at: z.string(),
  endAt: z.string().nullable(),
  latitude: z.number(),
  longitude: z.number(),
  storeId: z.string().nullable(),
  storeName: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  /**
   * Capturas da parada — o que o campo chama de "ativação".
   *
   * Não é o número de imagens: uma ativação sai com 1 a 3 fotos, e apresentar
   * as duas coisas com o mesmo rótulo triplica o trabalho de quem fotografou
   * uma gôndola por três ângulos.
   */
  activationCount: z.number(),
  /** Imagens dentro dessas capturas. */
  imageCount: z.number(),
  /** Intervalo desde a parada anterior; `null` na primeira. */
  gapFromPreviousMs: z.number().nullable(),
  /** O intervalo foi longo demais para ser deslocamento — a linha quebra aqui. */
  startsNewSegment: z.boolean(),
});

/** O período de um promotor num único cliente. */
export const storeVisitSchema = z.object({
  storeId: z.string(),
  storeName: z.string().nullable(),
  /** Paradas neste cliente no período — duas idas no mesmo dia contam duas. */
  visits: z.number(),
  activationCount: z.number(),
  imageCount: z.number(),
  activeMs: z.number(),
  /** Visitas que renderam duração. Denominador da média. */
  measuredVisits: z.number(),
  avgVisitMs: z.number(),
  firstAt: z.string(),
  lastAt: z.string(),
});

export const trailSchema = z.object({
  memberId: z.string(),
  name: z.string(),
  image: z.string().nullable(),
  points: z.array(trailPointSchema),
  firstAt: z.string().nullable(),
  lastAt: z.string().nullable(),
  storeCount: z.number(),
  activationCount: z.number(),
  imageCount: z.number(),
  activeMs: z.number(),
  travelMs: z.number(),
  idleMs: z.number(),
  spanMs: z.number(),
  unmeasuredStops: z.number(),
  measuredStops: z.number(),
  avgVisitMs: z.number(),
  byStore: z.array(storeVisitSchema),
});
