/**
 * O ticket usual de uma loja, e o corte abaixo do qual um dia é anormal.
 *
 * Puro e sem `server-only` porque duas coisas dependem dele e precisam do
 * MESMO número: a tool `vendasAbaixoDoTicketUsual`, que responde na conversa,
 * e o motor de avisos, que dispara sozinho. Dois cálculos parecidos dariam
 * duas respostas para a mesma pergunta.
 *
 * O método é declarado junto de propósito: número de anomalia sem método é
 * chute com cara de certeza.
 */

/** Dias de venda necessários para haver "usual". Menos que isso é ruído. */
export const DIAS_MINIMOS = 7;

export const METODO_DO_TICKET =
  "ticket usual = média dos tickets diários dos últimos 90 dias; abaixo = menor que a média menos um desvio-padrão";

export type TicketUsual = {
  media: number;
  desvio: number;
  /** A média menos um desvio: abaixo disto, o dia é anormal. */
  corte: number;
  diasAnalisados: number;
};

/** `null` quando não há dias de venda suficientes para dizer qual é o usual. */
export function calcularTicketUsual(
  tickets: readonly number[],
): TicketUsual | null {
  if (tickets.length < DIAS_MINIMOS) return null;

  const media = tickets.reduce((soma, t) => soma + t, 0) / tickets.length;
  const desvio = Math.sqrt(
    tickets.reduce((soma, t) => soma + (t - media) ** 2, 0) /
      (tickets.length - 1),
  );

  return {
    media,
    desvio,
    corte: media - desvio,
    diasAnalisados: tickets.length,
  };
}
