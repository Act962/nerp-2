const NON_ALNUM = /[^A-Z0-9]/g;

// Reusado pelo backfill de category -> sectorId (normaliza pra comparar com
// StoreSector.name).
export function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeForMatch(value: string): string {
  return stripAccents(value).toUpperCase().replace(NON_ALNUM, "");
}

export interface SpaceCodeParts {
  orgSigla: string;
  storeCode: string;
  // Códigos oficiais dos catálogos (MediaType.code / StoreSector.code) — não
  // mais a sigla da ferramenta de desenho. null quando o espaço ainda não
  // tem mídia/setor classificado; o segmento correspondente é omitido.
  mediaCode: string | null;
  seq: number;
  sectorCode: string | null;
}

// Junta só os segmentos não-nulos: WS-009-PG-002-PER (com mídia+setor) ou
// WS-009-002 (sem nenhum dos dois). Sequencial vira 3 dígitos com zero à esquerda.
export function formatSpaceCode(parts: SpaceCodeParts): string {
  const segments = [
    parts.orgSigla.toUpperCase(),
    parts.storeCode.toUpperCase(),
    parts.mediaCode,
    String(parts.seq).padStart(3, "0"),
    parts.sectorCode,
  ].filter((segment): segment is string => !!segment);
  return segments.join("-");
}
