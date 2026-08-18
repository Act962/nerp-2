import type { CompanySource } from "@/generated/prisma/enums";
import { isInBrazil } from "@/lib/brazil-bounds";
import prisma from "@/lib/db";
import { normalizeDocument } from "@/lib/document";
import { normalizePostcode } from "@/lib/postcode";
import { distanceMeters } from "@/lib/geo-distance";
import { normalizeStoreName } from "@/lib/store-name";
import { normalizeUf } from "@/lib/uf";

/** Acima disto, dois pontos com nome parecido ainda são lojas diferentes. */
const NEAR_METERS = 250;

/** Janela de busca por proximidade, em graus (~2 km) — antes do filtro fino. */
const SEARCH_DEGREES = 0.02;

export interface ResolveDirectoryStoreInput {
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  osmId?: string | null;
  /** CNPJ do estabelecimento, com ou sem máscara. */
  document?: string | null;
  address?: string | null;
  suburb?: string | null;
  city?: string | null;
  state?: string | null;
  /** CEP, com ou sem máscara. */
  postcode?: string | null;
  source: CompanySource;
  /** Auditoria — nunca sai em payload público. */
  sourceOrgId: string | null;
}

export interface ResolvedDirectoryStore {
  id: string;
  created: boolean;
}

export interface DirectoryStoreMatch {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Distância até o ponto de entrada, em metros (só no casamento por proximidade). */
  distanceM: number | null;
}

/**
 * Só BUSCA um ponto do catálogo que já represente esta loja — nunca cria.
 *
 * Mesma ordem de identidade do `resolveDirectoryStore` (CNPJ → osmId → nome +
 * 250 m). É a leitura que alimenta o preview do cadastro ("já existe como X?")
 * sem gravar nada. `resolveDirectoryStore` reusa esta função.
 */
export async function findDirectoryStoreMatch(
  input: ResolveDirectoryStoreInput,
): Promise<DirectoryStoreMatch | null> {
  const select = {
    id: true,
    name: true,
    address: true,
    city: true,
    state: true,
    latitude: true,
    longitude: true,
  } as const;

  const name = input.name.trim();

  // 1. CNPJ do estabelecimento: identidade exata, dispensa coordenada.
  const document = normalizeDocument(input.document);
  if (document) {
    const byDocument = await prisma.directoryStore.findUnique({
      where: { document },
      select,
    });
    if (byDocument) return { ...byDocument, distanceM: null };
  }

  // 2. O mesmo ponto do OpenStreetMap é o mesmo ponto.
  if (input.osmId) {
    const byOsm = await prisma.directoryStore.findUnique({
      where: { osmId: input.osmId },
      select,
    });
    if (byOsm) return { ...byOsm, distanceM: null };
  }

  const latitude = input.latitude ?? null;
  const longitude = input.longitude ?? null;
  const hasPosition =
    latitude !== null &&
    longitude !== null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    isInBrazil(latitude, longitude);

  // 3. Nome normalizado igual E a menos de 250 m (só com posição).
  const target = normalizeStoreName(name);
  if (hasPosition && target && name.length >= 2) {
    const nearby = await prisma.directoryStore.findMany({
      where: {
        latitude: {
          gte: latitude - SEARCH_DEGREES,
          lte: latitude + SEARCH_DEGREES,
        },
        longitude: {
          gte: longitude - SEARCH_DEGREES,
          lte: longitude + SEARCH_DEGREES,
        },
      },
      select,
      take: 200,
    });

    let best: { store: DirectoryStoreMatch; distance: number } | null = null;
    for (const point of nearby) {
      if (point.latitude === null || point.longitude === null) continue;
      if (normalizeStoreName(point.name) !== target) continue;
      const distance = distanceMeters(
        { latitude, longitude },
        { latitude: point.latitude, longitude: point.longitude },
      );
      if (distance > NEAR_METERS) continue;
      if (!best || distance < best.distance) {
        best = {
          store: { ...point, distanceM: Math.round(distance) },
          distance,
        };
      }
    }

    if (best) return best.store;
  }

  return null;
}

/**
 * A ÚNICA porta de escrita do catálogo nacional de PDVs.
 *
 * Cinco caminhos alimentam o catálogo — varredura do OpenStreetMap, cadastro do
 * super-admin, foto do promotor, importação de lista e cadastro de loja — e
 * todos passam por aqui. Se algum deixar de passar, a duplicata volta a nascer,
 * e o sintoma só aparece meses depois como dois pinos no mesmo endereço, sem
 * erro nenhum no caminho.
 *
 * **Identidade antes de semelhança**, em ordem de força:
 * 1. **CNPJ** — no Brasil matriz e filial têm documentos distintos, então ele
 *    identifica o estabelecimento. É a chave exata.
 * 2. **`osmId`** — identidade do ponto no OpenStreetMap.
 * 3. **Nome + 250 m** — palpite, e por isso exige os dois juntos.
 *
 * Ponto SEM coordenada é aceito: a lista de PDVs entra com endereço, e quem fixa
 * o pino é a primeira foto do promotor, que está na porta da loja. Isso troca
 * geocodificação em massa — que a política do Nominatim desencoraja e cujo
 * bloqueio derrubaria o endereço das fotos em produção — por trabalho de campo
 * que já acontece de qualquer forma.
 */
export async function resolveDirectoryStore(
  input: ResolveDirectoryStoreInput,
): Promise<ResolvedDirectoryStore | null> {
  const name = input.name.trim();
  if (name.length < 2) return null;

  // Identidade (CNPJ → osmId → nome+250 m) mora no matcher read-only.
  const match = await findDirectoryStoreMatch(input);
  if (match) return { id: match.id, created: false };

  const document = normalizeDocument(input.document);
  const latitude = input.latitude ?? null;
  const longitude = input.longitude ?? null;
  const hasPosition =
    latitude !== null &&
    longitude !== null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    isInBrazil(latitude, longitude);

  // Sem coordenada E sem CNPJ, o único casamento possível seria por nome solto
  // — que juntaria lojas diferentes em cidades diferentes. Recusar é o certo.
  if (!hasPosition && !document) return null;

  // 4. Ponto novo. `reviewedAt` nasce nulo: entra no catálogo na hora e é
  // conferido depois, que é o que permite ele crescer a cada visita de promotor
  // sem ficar sem supervisão.
  try {
    const created = await prisma.directoryStore.create({
      data: {
        name: name.slice(0, 140),
        osmId: input.osmId ?? null,
        document,
        latitude: hasPosition ? latitude : null,
        longitude: hasPosition ? longitude : null,
        address: input.address ?? null,
        suburb: input.suburb ?? null,
        city: input.city ?? null,
        state: normalizeUf(input.state),
        postcode: normalizePostcode(input.postcode),
        source: input.source,
        sourceOrgId: input.sourceOrgId,
      },
      select: { id: true },
    });
    return { id: created.id, created: true };
  } catch {
    // P2002: alguém cravou o mesmo ponto entre a checagem e o insert. O índice
    // único é o árbitro; reler é a resposta certa, não um 500.
    const raced = document
      ? await prisma.directoryStore.findUnique({
          where: { document },
          select: { id: true },
        })
      : input.osmId
        ? await prisma.directoryStore.findUnique({
            where: { osmId: input.osmId },
            select: { id: true },
          })
        : null;
    return raced ? { id: raced.id, created: false } : null;
  }
}
