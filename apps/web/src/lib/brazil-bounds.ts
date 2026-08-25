import "server-only";

/**
 * Caixa envolvente do Brasil.
 *
 * Serve a dois propósitos que costumam ser confundidos: pegar latitude e
 * longitude trocadas (o caso comum em importação de planilha) e manter o
 * catálogo de varejo restrito ao país — o TradeGram é um produto brasileiro e
 * um ponto fora daqui é erro, não expansão.
 */
export const BRAZIL_BOUNDS = {
  minLat: -34,
  maxLat: 6,
  minLng: -74,
  maxLng: -34,
} as const;

export function isInBrazil(latitude: number, longitude: number): boolean {
  return (
    latitude >= BRAZIL_BOUNDS.minLat &&
    latitude <= BRAZIL_BOUNDS.maxLat &&
    longitude >= BRAZIL_BOUNDS.minLng &&
    longitude <= BRAZIL_BOUNDS.maxLng
  );
}
