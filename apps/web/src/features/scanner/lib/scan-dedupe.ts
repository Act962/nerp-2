/**
 * Descarte de releitura do MESMO código.
 *
 * Vale para os dois leitores, e por motivos parecidos:
 *
 * - **Balcão (USB).** Em modo contínuo o leitor relê o item que fica parado no
 *   feixe. O operador acha que bipou uma vez e entram duas unidades.
 * - **Celular.** A câmera enxerga o mesmo item a cada tick enquanto apontada
 *   para ele; sem janela, parar em cima de um produto lançaria três unidades
 *   por segundo.
 *
 * A janela cobre a repetição acidental e ainda deixa passar a segunda unidade
 * de propósito: afastar o item e reaproximar é o gesto natural e leva mais que
 * isso. Subir muito este número recria o defeito oposto — o cliente já relatou
 * "bipei duas vezes e ficou 1".
 */
export const SCAN_DEDUPE_MS = 900;

export interface UltimaLeitura {
  code: string;
  /** `Date.now()` do momento em que a leitura foi aceita. */
  at: number;
}

export const NENHUMA_LEITURA: UltimaLeitura = { code: "", at: 0 };

export function ehLeituraRepetida(
  ultima: UltimaLeitura,
  code: string,
  agora: number,
  janelaMs: number = SCAN_DEDUPE_MS,
): boolean {
  if (ultima.code !== code) return false;
  return agora - ultima.at < janelaMs;
}
