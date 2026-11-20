"use client";

export type Posicao = {
  latitude: number;
  longitude: number;
  precisaoM: number;
};

/**
 * Uma leitura de GPS com prazo. Devolve `null` em vez de falhar: pedido e
 * check-in seguem sem localização (o servidor marca e pede justificativa
 * quando precisa), e o vendedor não fica preso esperando o satélite.
 */
export function obterPosicao(timeoutMs = 8000): Promise<Posicao | null> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (posicao) =>
        resolve({
          latitude: posicao.coords.latitude,
          longitude: posicao.coords.longitude,
          precisaoM: posicao.coords.accuracy,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    );
  });
}

/** Lê "7,99" ou "7.99" como número; vazio ou inválido vira `null`. */
export function lerDecimal(texto: string): number | null {
  const limpo = texto.trim().replace(/\s/g, "");
  if (!limpo) return null;
  const normalizado = limpo.includes(",")
    ? limpo.replace(/\./g, "").replace(",", ".")
    : limpo;
  const valor = Number(normalizado);
  return Number.isFinite(valor) ? valor : null;
}

export function escreverDecimal(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
