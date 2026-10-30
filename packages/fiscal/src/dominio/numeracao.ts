import type { StatusDocumentoFiscal } from "./documento-fiscal";

/** Faixa contínua de números de uma série, inclusiva nas duas pontas. */
export type Faixa = { inicio: number; fim: number };

/**
 * Rejeitada recente ainda é "a nota daquela venda": o caixa pode estar
 * corrigindo o cadastro para reenviar. Só depois disso o número conta como
 * pulado e aparece para inutilizar.
 */
export const JANELA_REENVIO_MS = 24 * 60 * 60 * 1000;

/**
 * O número está tomado? Autorizada, cancelada e denegada existem na SEFAZ;
 * pendente e em processamento ainda vão existir. Rejeitada não consome número
 * na SEFAZ — só a guardamos até a janela de reenvio passar.
 */
export function numeroOcupado(
  documento: { status: StatusDocumentoFiscal; ultimaTentativaEm: Date | null },
  agora: Date,
): boolean {
  if (documento.status === "VOIDED") return false;
  if (documento.status !== "REJECTED") return true;
  const ultima = documento.ultimaTentativaEm?.getTime() ?? 0;
  return agora.getTime() - ultima < JANELA_REENVIO_MS;
}

/** `[1, 2, 3, 7, 8]` → `[{1–3}, {7–8}]`. */
export function agruparEmFaixas(numeros: Iterable<number>): Faixa[] {
  const ordenados = [...new Set(numeros)].sort((a, b) => a - b);
  const faixas: Faixa[] = [];
  for (const n of ordenados) {
    const ultima = faixas.at(-1);
    if (ultima && n === ultima.fim + 1) ultima.fim = n;
    else faixas.push({ inicio: n, fim: n });
  }
  return faixas;
}

/**
 * Números que a série reservou e nunca viraram nota válida — o que a SEFAZ
 * espera ver inutilizado. Conta de `primeiro` (onde o NERP começou a emitir
 * nesta série) até o último reservado (`proximo - 1`); o que veio antes é de
 * outro sistema e não temos como saber.
 */
export function numerosPulados(input: {
  primeiro: number;
  proximo: number;
  ocupados: Iterable<number>;
  inutilizadas: Faixa[];
}): Faixa[] {
  const ocupados = new Set(input.ocupados);
  const livres: number[] = [];
  for (let n = input.primeiro; n < input.proximo; n++) {
    if (ocupados.has(n)) continue;
    if (input.inutilizadas.some((f) => n >= f.inicio && n <= f.fim)) continue;
    livres.push(n);
  }
  return agruparEmFaixas(livres);
}

export function tamanhoDaFaixa(f: Faixa): number {
  return f.fim - f.inicio + 1;
}
