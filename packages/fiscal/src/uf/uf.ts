/**
 * UFs brasileiras: sigla → código IBGE (os dois primeiros dígitos da chave de
 * acesso). Tabela fechada — dado público e estável desde 1988.
 */

export const UF_CODIGO_IBGE = {
  RO: 11,
  AC: 12,
  AM: 13,
  RR: 14,
  PA: 15,
  AP: 16,
  TO: 17,
  MA: 21,
  PI: 22,
  CE: 23,
  RN: 24,
  PB: 25,
  PE: 26,
  AL: 27,
  SE: 28,
  BA: 29,
  MG: 31,
  ES: 32,
  RJ: 33,
  SP: 35,
  PR: 41,
  SC: 42,
  RS: 43,
  MS: 50,
  MT: 51,
  GO: 52,
  DF: 53,
} as const;

export type Uf = keyof typeof UF_CODIGO_IBGE;

export const UFS = Object.keys(UF_CODIGO_IBGE) as Uf[];

export function isUf(value: string): value is Uf {
  return value in UF_CODIGO_IBGE;
}

export function codigoIbgeDaUf(uf: Uf): number {
  return UF_CODIGO_IBGE[uf];
}

/** Sigla a partir do código IBGE — usado para rotear pela chave de acesso. */
export function ufDoCodigoIbge(codigo: number): Uf | null {
  const encontrada = UFS.find((uf) => UF_CODIGO_IBGE[uf] === codigo);
  return encontrada ?? null;
}
