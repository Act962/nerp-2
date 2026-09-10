import {
  inicioDoDiaNaLoja,
  maisDias,
  STORE_TZ,
} from "@/features/sales/lib/period-range";
import type { IntervaloDeDatas } from "@/features/sales/lib/venda-valida";

/**
 * Os períodos que o Astro entende, sempre no fuso da loja.
 *
 * Reaproveita o recorte de /vendas (`period-range.ts`) em vez de recalcular:
 * havia três implementações de "início do dia" no repo, e uma delas usava a
 * hora do servidor — em Fortaleza (UTC−3), tudo o que se vende depois das 21h
 * caía no dia seguinte.
 *
 * Intervalo semiaberto `[from, to)`, como lá.
 */

export const PERIODOS = [
  "hoje",
  "ontem",
  "7d",
  "30d",
  "mes",
  "mes_anterior",
] as const;

export type Periodo = (typeof PERIODOS)[number];

export const ROTULO_DO_PERIODO: Record<Periodo, string> = {
  hoje: "hoje",
  ontem: "ontem",
  "7d": "últimos 7 dias",
  "30d": "últimos 30 dias",
  mes: "este mês",
  mes_anterior: "mês passado",
};

export function intervaloDoPeriodo(
  periodo: Periodo,
  agora: Date = new Date(),
  timeZone: string = STORE_TZ,
): IntervaloDeDatas {
  const hoje = inicioDoDiaNaLoja(agora, timeZone);

  switch (periodo) {
    case "hoje":
      return { from: hoje, to: maisDias(hoje, 1) };
    case "ontem":
      return { from: maisDias(hoje, -1), to: hoje };
    case "7d":
      return { from: maisDias(hoje, -6), to: maisDias(hoje, 1) };
    case "30d":
      return { from: maisDias(hoje, -29), to: maisDias(hoje, 1) };
    case "mes":
      return {
        from: inicioDoMesNaLoja(agora, timeZone),
        to: maisDias(hoje, 1),
      };
    case "mes_anterior": {
      const inicioDesteMes = inicioDoMesNaLoja(agora, timeZone);
      // Um dia antes do dia 1 cai no mês passado, seja qual for o tamanho dele.
      const noMesPassado = maisDias(inicioDesteMes, -1);
      return {
        from: inicioDoMesNaLoja(noMesPassado, timeZone),
        to: inicioDesteMes,
      };
    }
  }
}

/**
 * O período imediatamente anterior, do mesmo tamanho — é com ele que o Astro
 * compara ("30% a mais que na semana passada").
 */
export function intervaloAnterior(
  intervalo: IntervaloDeDatas,
): IntervaloDeDatas {
  const duracao = intervalo.to.getTime() - intervalo.from.getTime();
  return {
    from: new Date(intervalo.from.getTime() - duracao),
    to: intervalo.from,
  };
}

function inicioDoMesNaLoja(instante: Date, timeZone: string): Date {
  const hoje = inicioDoDiaNaLoja(instante, timeZone);
  // Recua até o dia 1: `inicioDoDiaNaLoja` já resolve o fuso, então basta
  // andar para trás em dias até o primeiro do mês (no máximo 30 voltas).
  let cursor = hoje;
  for (let i = 0; i < 31; i++) {
    const anterior = inicioDoDiaNaLoja(maisDias(cursor, -1), timeZone);
    if (mesDe(anterior, timeZone) !== mesDe(cursor, timeZone)) return cursor;
    cursor = anterior;
  }
  return cursor;
}

function mesDe(instante: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).format(instante);
}
