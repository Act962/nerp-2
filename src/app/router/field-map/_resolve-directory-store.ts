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

  // 1. CNPJ do estabelecimento: identidade exata, dispensa coordenada.
  const document = normalizeDocument(input.document);
  if (document) {
    const byDocument = await prisma.directoryStore.findUnique({
      where: { document },
      select: { id: true },
    });
    if (byDocument) return { id: byDocument.id, created: false };
  }

  // 2. O mesmo ponto do OpenStreetMap é o mesmo ponto, ponto final.
  if (input.osmId) {
    const byOsm = await prisma.directoryStore.findUnique({
      where: { osmId: input.osmId },
      select: { id: true },
    });
    if (byOsm) return { id: byOsm.id, created: false };
  }

  const latitude = input.latitude ?? null;
  const longitude = input.longitude ?? null;
  const hasPosition =
    latitude !== null &&
    longitude !== null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    isInBrazil(latitude, longitude);

  // 3. Semelhança, só quando há posição: nome normalizado igual E a menos de
  // 250 m. Os dois juntos — "Supermercado São José" da Zona Leste e o da Zona
  // Sul são lojas diferentes com o mesmo nome, e duas lojas coladas com nomes
  // distintos também são duas.
  const target = normalizeStoreName(name);
  if (hasPosition && target) {
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
      select: { id: true, name: true, latitude: true, longitude: true },
      take: 200,
    });

    let best: { id: string; distance: number } | null = null;
    for (const point of nearby) {
      if (point.latitude === null || point.longitude === null) continue;
      if (normalizeStoreName(point.name) !== target) continue;
      const distance = distanceMeters(
        { latitude, longitude },
        { latitude: point.latitude, longitude: point.longitude },
      );
      if (distance > NEAR_METERS) continue;
      if (!best || distance < best.distance) best = { id: point.id, distance };
    }

    if (best) return { id: best.id, created: false };
  }

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
