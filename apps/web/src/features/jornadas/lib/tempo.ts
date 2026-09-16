import type { Jornada, Passo } from "../catalogo/tipos";

/**
 * Quanto tempo um passo precisa ficar na tela antes de "Próximo" valer.
 *
 * É o que separa aprender de colecionar ★. Sem piso, a jornada inteira cabe em
 * dois segundos de cliques e a recompensa deixa de significar qualquer coisa.
 *
 * A conta é o tempo de LEITURA do texto — 200 palavras por minuto, que é a
 * média de leitura em tela —, nunca um número redondo igual para todo passo:
 * um aviso de uma linha não deve travar a pessoa pelo mesmo tanto que um passo
 * que explica o fechamento de caixa.
 */
const MS_POR_PALAVRA = 300;
const PISO_MS = 2000;

export function palavras(texto: string): number {
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

export function tempoMinimoDoPasso(passo: Passo): number {
  if (passo.tempoMinimoMs !== undefined) return passo.tempoMinimoMs;
  const total = palavras(passo.titulo) + palavras(passo.texto);
  return Math.max(PISO_MS, total * MS_POR_PALAVRA);
}

/**
 * O piso da jornada inteira, conferido pelo SERVIDOR na conclusão contra o
 * `iniciadaEm` que ele mesmo gravou. O relógio do cliente não entra na conta:
 * ele é de quem quer a recompensa.
 */
export function tempoMinimoDaJornada(jornada: Jornada): number {
  return jornada.passos.reduce(
    (soma, passo) => soma + tempoMinimoDoPasso(passo),
    0,
  );
}

/** "~3 min" para o convite. Arredonda para cima: prometer menos irrita. */
export function minutosDaJornada(jornada: Jornada): number {
  return Math.max(1, Math.ceil(tempoMinimoDaJornada(jornada) / 60_000));
}
