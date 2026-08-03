/**
 * Casamento entre um ponto do OpenStreetMap e os clientes já cadastrados.
 *
 * Existe porque o usuário vai importar a própria lista depois, e ela vai
 * encontrar aqui os mesmos supermercados. Duplicar cliente é pior que não
 * importar: o promotor passa a ver dois pinos da mesma loja e as fotos se
 * dividem entre os dois cadastros.
 *
 * A decisão nunca é automática — isto só CLASSIFICA. Quem confirma a fusão é a
 * pessoa na tela, porque "Mercado São José" da Zona Leste e o da Zona Sul são
 * lojas diferentes com o mesmo nome, e nenhuma heurística sabe disso.
 */

import { distanceMeters } from "@/lib/geo-distance";
import { normalizeStoreName } from "@/lib/store-name";

/** Acima disto, dois pontos com nome parecido ainda são lojas diferentes. */
const NEAR_METERS = 250;

// Reexportado: uma normalização só para OSM, planilha e dedupe.
export { normalizeStoreName } from "@/lib/store-name";

// Reexportada para os call sites deste módulo não mudarem de import.
export { distanceMeters } from "@/lib/geo-distance";

export interface ExistingStore {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  osmId: string | null;
}

export type OsmMatchStatus = "NOVO" | "JA_IMPORTADO" | "POSSIVEL_DUPLICADO";

export interface OsmMatch {
  status: OsmMatchStatus;
  storeId: string | null;
  storeName: string | null;
  /** `null` quando o cliente existente ainda não tem posição no mapa. */
  distanceM: number | null;
  reason: string | null;
}

const NO_MATCH: OsmMatch = {
  status: "NOVO",
  storeId: null,
  storeName: null,
  distanceM: null,
  reason: null,
};

/**
 * O `osmId` vence sempre: é identidade, não semelhança. Só depois dele é que
 * entram nome e distância, que são palpite.
 */
export function matchOsmStore(
  candidate: {
    osmId: string;
    name: string;
    latitude: number;
    longitude: number;
  },
  existing: ExistingStore[],
): OsmMatch {
  const byOsm = existing.find((store) => store.osmId === candidate.osmId);
  if (byOsm) {
    return {
      status: "JA_IMPORTADO",
      storeId: byOsm.id,
      storeName: byOsm.name,
      distanceM: null,
      reason: "Já foi importado deste mesmo ponto do OpenStreetMap",
    };
  }

  const target = normalizeStoreName(candidate.name);
  if (!target) return NO_MATCH;

  let best: OsmMatch = NO_MATCH;

  for (const store of existing) {
    if (store.osmId) continue;

    const sameName = normalizeStoreName(store.name) === target;
    const distance =
      store.latitude !== null && store.longitude !== null
        ? distanceMeters(candidate, {
            latitude: store.latitude,
            longitude: store.longitude,
          })
        : null;
    const near = distance !== null && distance <= NEAR_METERS;

    if (!sameName && !near) continue;

    // Nome igual E perto é quase certeza; só um dos dois é suspeita. Guardar a
    // mais forte evita que um vizinho qualquer roube o casamento do certo.
    const reason =
      sameName && near
        ? "Mesmo nome e a poucos metros de um cliente já cadastrado"
        : sameName
          ? "Mesmo nome de um cliente já cadastrado"
          : "A poucos metros de um cliente já cadastrado";

    const stronger =
      best.status !== "POSSIVEL_DUPLICADO" ||
      (distance !== null &&
        (best.distanceM === null || distance < best.distanceM));

    if (stronger) {
      best = {
        status: "POSSIVEL_DUPLICADO",
        storeId: store.id,
        storeName: store.name,
        distanceM: distance === null ? null : Math.round(distance),
        reason,
      };
    }
  }

  return best;
}
