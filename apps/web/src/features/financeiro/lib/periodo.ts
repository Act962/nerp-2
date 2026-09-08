import { toDateInput } from "@/utils/date-input";

/**
 * O período do painel financeiro: dois dias em "YYYY-MM-DD", inclusivos.
 *
 * É o mesmo formato que `financeiro.entries.list`, `dashboard.cashflow`,
 * `reports.dre` e `reports.dro` já recebem — o filtro global não inventou
 * contrato novo, só passou a ser um lugar só em vez de três cópias.
 */
export interface Periodo {
  from: string;
  to: string;
}

/** Dia de um `Date` em horário LOCAL. */
function dia(date: Date): string {
  return toDateInput(date.toISOString());
}

export function mesAtual(): Periodo {
  const hoje = new Date();
  return {
    from: dia(new Date(hoje.getFullYear(), hoje.getMonth(), 1)),
    to: dia(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)),
  };
}

/**
 * Atalhos do picker. Não incluem "tudo": as quatro abas de período pedem um
 * intervalo fechado ao servidor, e um período aberto viraria varredura da
 * tabela inteira de lançamentos.
 */
export const ATALHOS: { label: string; periodo: () => Periodo }[] = [
  { label: "Este mês", periodo: mesAtual },
  {
    label: "Mês passado",
    periodo: () => {
      const hoje = new Date();
      return {
        from: dia(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)),
        to: dia(new Date(hoje.getFullYear(), hoje.getMonth(), 0)),
      };
    },
  },
  {
    label: "Últimos 30 dias",
    periodo: () => {
      const hoje = new Date();
      const inicio = new Date(hoje);
      inicio.setDate(inicio.getDate() - 29);
      return { from: dia(inicio), to: dia(hoje) };
    },
  },
  {
    label: "Este ano",
    periodo: () => {
      const hoje = new Date();
      return {
        from: dia(new Date(hoje.getFullYear(), 0, 1)),
        to: dia(new Date(hoje.getFullYear(), 11, 31)),
      };
    },
  },
];

/** "YYYY-MM-DD" → `Date` no fuso local, para alimentar o calendário. */
export function paraDate(value: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function paraDia(date: Date): string {
  return dia(date);
}
