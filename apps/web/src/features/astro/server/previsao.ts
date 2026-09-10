/**
 * Previsão de vendas — estatística, sem modelo treinado.
 *
 * O método é declarado na resposta de propósito: "o Astro acha que vai vender
 * X" só é útil se a pessoa souber de onde veio o X, e um número sem método é
 * um chute com cara de certeza.
 *
 * Nível: média dos últimos 28 dias (quatro semanas fechadas, para o efeito do
 * dia da semana se anular). Sazonalidade: fator por dia da semana, a média
 * daquele dia dividida pela média geral. Faixa: ±1 desvio-padrão dos resíduos.
 *
 * Módulo puro (sem `server-only`): é testado com série sintética.
 */

export interface PontoDaSerie {
  /** Meia-noite do dia, no fuso da loja. */
  data: Date;
  valor: number;
}

export interface DiaPrevisto {
  data: Date;
  previsto: number;
  min: number;
  max: number;
}

export interface Previsao {
  metodo: string;
  confianca: "baixa" | "media" | "alta";
  diasDeHistorico: number;
  media: number;
  fatoresPorDiaDaSemana: number[];
  dias: DiaPrevisto[];
  total: number;
}

/** Dias de histórico que a média usa — quatro semanas fechadas. */
export const JANELA_DA_MEDIA = 28;

const DIA_MS = 86_400_000;

export function preverSerie(
  historico: readonly PontoDaSerie[],
  horizonteDias: number,
  hoje: Date = new Date(),
): Previsao {
  const ordenado = [...historico].sort(
    (a, b) => a.data.getTime() - b.data.getTime(),
  );
  const recente = ordenado.slice(-JANELA_DA_MEDIA);
  const diasDeHistorico = recente.length;

  if (diasDeHistorico === 0) {
    return {
      metodo: "sem histórico de vendas para projetar",
      confianca: "baixa",
      diasDeHistorico: 0,
      media: 0,
      fatoresPorDiaDaSemana: Array(7).fill(1),
      dias: [],
      total: 0,
    };
  }

  const media =
    recente.reduce((soma, ponto) => soma + ponto.valor, 0) / diasDeHistorico;

  const fatores = fatoresPorDiaDaSemana(recente, media);

  // Resíduo = quanto cada dia observado ficou longe do que o método previria.
  const residuos = recente.map(
    (ponto) => ponto.valor - media * (fatores[diaDaSemana(ponto.data)] ?? 1),
  );
  const desvio = desvioPadrao(residuos);

  const inicio = new Date(meiaNoiteUtcDe(hoje) + DIA_MS);
  const dias: DiaPrevisto[] = [];
  for (let i = 0; i < horizonteDias; i++) {
    const data = new Date(inicio.getTime() + i * DIA_MS);
    const previsto = media * (fatores[diaDaSemana(data)] ?? 1);
    dias.push({
      data,
      previsto: arredondar(previsto),
      min: arredondar(Math.max(0, previsto - desvio)),
      max: arredondar(previsto + desvio),
    });
  }

  return {
    metodo: `média dos últimos ${diasDeHistorico} dias com ajuste por dia da semana; faixa de ±1 desvio-padrão`,
    confianca:
      diasDeHistorico >= JANELA_DA_MEDIA
        ? "alta"
        : diasDeHistorico >= 14
          ? "media"
          : "baixa",
    diasDeHistorico,
    media: arredondar(media),
    fatoresPorDiaDaSemana: fatores.map((f) => Number(f.toFixed(3))),
    dias,
    total: arredondar(dias.reduce((soma, dia) => soma + dia.previsto, 0)),
  };
}

/**
 * Um fator por dia da semana. Dia sem amostra fica em 1 (neutro) — inventar
 * sazonalidade a partir de zero observações é o caminho mais curto para uma
 * previsão confiante e errada.
 */
function fatoresPorDiaDaSemana(
  serie: readonly PontoDaSerie[],
  media: number,
): number[] {
  if (media <= 0) return Array(7).fill(1);

  const somas = Array(7).fill(0);
  const contagens = Array(7).fill(0);
  for (const ponto of serie) {
    const dia = diaDaSemana(ponto.data);
    somas[dia] += ponto.valor;
    contagens[dia] += 1;
  }

  return somas.map((soma, dia) =>
    contagens[dia] > 0 ? soma / contagens[dia] / media : 1,
  );
}

function diaDaSemana(data: Date): number {
  return data.getUTCDay();
}

function desvioPadrao(valores: readonly number[]): number {
  if (valores.length < 2) return 0;
  const media = valores.reduce((soma, v) => soma + v, 0) / valores.length;
  const variancia =
    valores.reduce((soma, v) => soma + (v - media) ** 2, 0) /
    (valores.length - 1);
  return Math.sqrt(variancia);
}

function meiaNoiteUtcDe(data: Date): number {
  return Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate());
}

function arredondar(valor: number): number {
  return Number(valor.toFixed(2));
}
