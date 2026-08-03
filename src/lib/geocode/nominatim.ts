import "server-only";

/**
 * Porta ÚNICA para o Nominatim (OpenStreetMap).
 *
 * Uma política, um lugar. O reverse-geocode da captura do promotor está em
 * produção e um laço mal feito em qualquer outro ponto bloquearia o IP,
 * derrubando os dois — daí não existir `fetch` direto ao Nominatim fora daqui.
 *
 * Escala: trocar `NOMINATIM_URL` por uma instância própria é a única mudança
 * necessária; o resto do código não sabe qual servidor está atendendo.
 */

const NOMINATIM_URL =
  process.env.NOMINATIM_URL ?? "https://nominatim.openstreetmap.org";

/** A política pede app identificável e uma forma de contato. */
function headers(): HeadersInit {
  const domain = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? "tradegram";
  const contact = process.env.GEOCODE_CONTACT_EMAIL;
  return {
    "User-Agent": `nerp-2/1.0 (+https://${domain}${contact ? `; ${contact}` : ""})`,
  };
}

type NominatimAddress = {
  road?: string;
  house_number?: string;
  suburb?: string;
  neighbourhood?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  state?: string;
  postcode?: string;
};

export interface GeoPlace {
  city: string | null;
  state: string | null;
  road: string | null;
  houseNumber: string | null;
  suburb: string | null;
  postcode: string | null;
  /** Endereço montado para exibição: "Rua X, 123 — Centro". */
  label: string | null;
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
  /** `addresstype` do provedor: building | road | suburb | city… */
  precision: string | null;
  label: string | null;
}

function pickCity(address: NominatimAddress): string | null {
  return (
    address.city ??
    address.town ??
    address.village ??
    address.municipality ??
    null
  );
}

function buildLabel(address: NominatimAddress): string | null {
  const street = [address.road, address.house_number]
    .filter(Boolean)
    .join(", ");
  const district = address.suburb ?? address.neighbourhood ?? null;
  const parts = [street || null, district].filter(Boolean);
  return parts.length > 0 ? parts.join(" — ") : null;
}

async function request(url: URL): Promise<unknown | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, {
      headers: headers(),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Coordenada → endereço. `zoom=18` traz rua, número e bairro; `zoom=10`, que
 * era o usado antes, só devolvia município. É a MESMA requisição — subir o zoom
 * não custa nada e é o que permite preencher o endereço da loja pela foto.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<GeoPlace> {
  const empty: GeoPlace = {
    city: null,
    state: null,
    road: null,
    houseNumber: null,
    suburb: null,
    postcode: null,
    label: null,
  };

  const url = new URL(`${NOMINATIM_URL}/reverse`);
  url.searchParams.set("format", "json");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("zoom", "18");
  url.searchParams.set("addressdetails", "1");

  const data = (await request(url)) as { address?: NominatimAddress } | null;
  if (!data?.address) return empty;

  const address = data.address;
  return {
    city: pickCity(address),
    state: address.state ?? null,
    road: address.road ?? null,
    houseNumber: address.house_number ?? null,
    suburb: address.suburb ?? address.neighbourhood ?? null,
    postcode: address.postcode ?? null,
    label: buildLabel(address),
  };
}

/**
 * Endereço → coordenada. Usa o endpoint ESTRUTURADO, não `q=` livre: a política
 * do Nominatim prefere assim quando há campos separados, e a loja tem.
 */
export async function forwardGeocode(params: {
  street: string | null;
  city: string | null;
  state: string | null;
}): Promise<GeoPoint | null> {
  const url = new URL(`${NOMINATIM_URL}/search`);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "br");
  if (params.street) url.searchParams.set("street", params.street);
  if (params.city) url.searchParams.set("city", params.city);
  if (params.state) url.searchParams.set("state", params.state);

  const data = (await request(url)) as Array<{
    lat: string;
    lon: string;
    addresstype?: string;
    display_name?: string;
  }> | null;

  const hit = data?.[0];
  if (!hit) return null;

  const latitude = Number(hit.lat);
  const longitude = Number(hit.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return {
    latitude,
    longitude,
    precision: hit.addresstype ?? null,
    label: hit.display_name ?? null,
  };
}

export interface PlaceHit {
  /** `node/123` quando o resultado é um ponto do OSM; `null` para outros. */
  osmId: string | null;
  name: string;
  label: string;
  latitude: number;
  longitude: number;
  /** `class`/`type` do OSM — é o que revela se o resultado é um supermercado. */
  category: string | null;
  isSupermarket: boolean;
}

/**
 * Busca livre por nome, no Brasil inteiro.
 *
 * Texto livre aqui é o certo — quem digita "Carvalho Parnaíba" não tem rua nem
 * CEP para preencher, é justamente o caso que o endpoint estruturado não cobre.
 *
 * A política do Nominatim proíbe autocomplete a cada tecla; quem chama precisa
 * disparar isto só no Enter ou no clique, nunca no `onChange`.
 */
export async function searchPlaces(query: string): Promise<PlaceHit[]> {
  const url = new URL(`${NOMINATIM_URL}/search`);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", query);
  url.searchParams.set("countrycodes", "br");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "25");

  const data = (await request(url)) as Array<{
    osm_type?: string;
    osm_id?: number;
    lat: string;
    lon: string;
    name?: string;
    display_name?: string;
    category?: string;
    type?: string;
  }> | null;

  if (!data) return [];

  const hits: PlaceHit[] = [];
  for (const item of data) {
    const latitude = Number(item.lat);
    const longitude = Number(item.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

    const label = item.display_name ?? "";
    const name = item.name?.trim() || label.split(",")[0]?.trim() || label;

    hits.push({
      osmId:
        item.osm_type && item.osm_id ? `${item.osm_type}/${item.osm_id}` : null,
      name,
      label,
      latitude,
      longitude,
      category: item.type ?? item.category ?? null,
      isSupermarket: item.type === "supermarket",
    });
  }

  return hits;
}

/**
 * Chave de cache do endereço já consultado. Devolve `null` quando não há
 * endereço suficiente para valer a pergunta — perguntar por "PI" sozinho só
 * devolveria o centroide do estado.
 */
export function buildStoreGeoQuery(store: {
  address: string | null;
  city: string | null;
  state: string | null;
}): string | null {
  const parts = [store.address, store.city, store.state]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  // Sem rua, o resultado seria o centro da cidade — que é pior que pino nenhum,
  // porque parece certo.
  if (!store.address?.trim()) return null;

  return parts.join(", ").replace(/\s+/g, " ").toUpperCase();
}
