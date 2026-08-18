import type { SceneObject } from "./types";

/**
 * Campos de negociação do PDV. Moram em `MapObject.properties` (JSON), evitando
 * uma coluna nova por campo enquanto o formato ainda evolui com o cliente.
 */
export interface NegotiationProps {
  location: string | null;
  spaceType: string | null;
  distributor: string | null;
  negotiationStart: string | null;
  negotiationEnd: string | null;
}

export type NegotiationField = keyof NegotiationProps;

const EMPTY: NegotiationProps = {
  location: null,
  spaceType: null,
  distributor: null,
  negotiationStart: null,
  negotiationEnd: null,
};

function readString(
  properties: Record<string, unknown>,
  key: string,
): string | null {
  const value = properties[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function readNegotiation(
  properties: Record<string, unknown> | null | undefined,
): NegotiationProps {
  if (!properties) return EMPTY;
  return {
    location: readString(properties, "location"),
    spaceType: readString(properties, "spaceType"),
    distributor: readString(properties, "distributor"),
    negotiationStart: readString(properties, "negotiationStart"),
    negotiationEnd: readString(properties, "negotiationEnd"),
  };
}

/** Mescla um campo no `properties` preservando chaves desconhecidas. */
export function withNegotiationField(
  object: SceneObject,
  field: NegotiationField,
  value: string,
): Record<string, unknown> {
  return {
    ...(object.properties ?? {}),
    [field]: value.length > 0 ? value : null,
  };
}
