import "server-only";

/**
 * Porta ÚNICA para o Overpass (a API de consulta do OpenStreetMap).
 *
 * Mesma disciplina do `nominatim.ts` e pelo mesmo motivo: o Overpass é um
 * serviço voluntário e um laço mal feito bloqueia o IP inteiro — o que aqui
 * derrubaria junto o reverse-geocode da captura, que está em produção.
 *
 * Por isso: nunca automático (toda busca nasce de um clique), área limitada,
 * timeout curto e uma consulta por vez. Trocar `OVERPASS_URL` por uma instância
 * própria é a única mudança necessária para escalar.
 */

const OVERPASS_URL =
  process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter";

/**
 * Teto da área varrida, em graus quadrados (~0.25 ≈ 55 km × 55 km).
 *
 * Não é conforto: pedir o Brasil inteiro numa requisição é exatamente o uso que
 * a política proíbe, e o servidor responderia com timeout depois de segurar
 * recurso de todo mundo. O valor vem de medição — Teresina inteira (0.09) volta
 * com 87 supermercados em poucos segundos, então uma região metropolitana cabe
 * com folga e o teto continua longe do abuso.
 */
const MAX_AREA_DEG2 = 0.25;

/** Teto de resultados por busca — protege a tela e o servidor do outro lado. */
const MAX_RESULTS = 200;

export interface OsmBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface OsmSupermarket {
  /** `node/123456` — identidade estável do ponto no OSM. */
  osmId: string;
  name: string;
  brand: string | null;
  latitude: number;
  longitude: number;
  /** "Rua X, 123" quando o OSM tem os dois campos. */
  address: string | null;
  suburb: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
}

export interface OsmSearchResult {
  stores: OsmSupermarket[];
  /** Pontos de supermercado sem nome no OSM — não viram cliente, mas existem. */
  unnamed: number;
  truncated: boolean;
}

type OverpassTags = Record<string, string | undefined>;

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: OverpassTags;
};

export function boundsArea(bounds: OsmBounds): number {
  return (
    Math.abs(bounds.north - bounds.south) * Math.abs(bounds.east - bounds.west)
  );
}

export function boundsTooLarge(bounds: OsmBounds): boolean {
  return boundsArea(bounds) > MAX_AREA_DEG2;
}

/**
 * `shop=supermarket` é exatamente a etiqueta que o OpenStreetMap desenha com o
 * ícone de carrinho no mapa — o que a pessoa está vendo é o que ela recebe.
 */
function buildQuery(bounds: OsmBounds): string {
  const box = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
  return `[out:json][timeout:25];
(
  node["shop"="supermarket"](${box});
  way["shop"="supermarket"](${box});
);
out center ${MAX_RESULTS + 1};`;
}

function pickAddress(tags: OverpassTags): string | null {
  const street = tags["addr:street"];
  if (!street) return null;
  const number = tags["addr:housenumber"];
  return number ? `${street}, ${number}` : street;
}

function toStore(element: OverpassElement): OsmSupermarket | null {
  const tags = element.tags ?? {};
  const name = tags.name?.trim();
  if (!name) return null;

  // `way` (o polígono do prédio) não tem lat/lon próprio — o `out center` é
  // justamente o que devolve o centroide dele.
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return {
    osmId: `${element.type}/${element.id}`,
    name: name.slice(0, 140),
    brand: tags.brand?.trim() ?? null,
    latitude: latitude as number,
    longitude: longitude as number,
    address: pickAddress(tags),
    suburb: tags["addr:suburb"]?.trim() ?? null,
    city: tags["addr:city"]?.trim() ?? null,
    state: tags["addr:state"]?.trim() ?? null,
    postcode: tags["addr:postcode"]?.trim() ?? null,
  };
}

/**
 * Supermercados dentro da área visível.
 *
 * Devolve `null` quando o provedor não responde: quem chama distingue "não há
 * supermercado aqui" de "não deu para perguntar", e essas duas coisas não podem
 * aparecer iguais na tela.
 */
export async function findSupermarkets(
  bounds: OsmBounds,
): Promise<OsmSearchResult | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const domain = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? "tradegram";
    const contact = process.env.GEOCODE_CONTACT_EMAIL;
    const response = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=UTF-8",
        "User-Agent": `nerp-2/1.0 (+https://${domain}${contact ? `; ${contact}` : ""})`,
      },
      body: buildQuery(bounds),
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const data = (await response.json()) as { elements?: OverpassElement[] };
    const elements = data.elements ?? [];

    const stores: OsmSupermarket[] = [];
    let unnamed = 0;
    for (const element of elements) {
      const store = toStore(element);
      if (store) stores.push(store);
      else unnamed += 1;
    }

    return {
      stores: stores.slice(0, MAX_RESULTS),
      unnamed,
      truncated: stores.length > MAX_RESULTS,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
