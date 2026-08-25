import type { SalesGoalPeriodType } from "./sales-goal-xlsx-parser";

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfWeekMonday(date: Date): Date {
  const day = date.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() + diffToMonday);
  return monday;
}

// Limites do período "corrente" (agora) para cada granularidade — usado
// quando o admin adiciona uma meta manualmente sem ter importado planilha.
export function currentPeriodBounds(
  periodType: SalesGoalPeriodType,
  referenceDate: Date = new Date(),
): { periodStart: string; periodEnd: string } {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();

  switch (periodType) {
    case "DAILY": {
      const day = new Date(Date.UTC(year, month, referenceDate.getUTCDate()));
      return { periodStart: toIsoDate(day), periodEnd: toIsoDate(day) };
    }
    case "WEEKLY": {
      const monday = startOfWeekMonday(referenceDate);
      const sunday = new Date(monday);
      sunday.setUTCDate(monday.getUTCDate() + 6);
      return { periodStart: toIsoDate(monday), periodEnd: toIsoDate(sunday) };
    }
    case "BIMONTHLY": {
      const blockStartMonth = Math.floor(month / 2) * 2;
      const start = new Date(Date.UTC(year, blockStartMonth, 1));
      const end = new Date(Date.UTC(year, blockStartMonth + 2, 0));
      return { periodStart: toIsoDate(start), periodEnd: toIsoDate(end) };
    }
    case "QUARTERLY": {
      const blockStartMonth = Math.floor(month / 3) * 3;
      const start = new Date(Date.UTC(year, blockStartMonth, 1));
      const end = new Date(Date.UTC(year, blockStartMonth + 3, 0));
      return { periodStart: toIsoDate(start), periodEnd: toIsoDate(end) };
    }
    case "SEMIANNUAL": {
      const blockStartMonth = month < 6 ? 0 : 6;
      const start = new Date(Date.UTC(year, blockStartMonth, 1));
      const end = new Date(Date.UTC(year, blockStartMonth + 6, 0));
      return { periodStart: toIsoDate(start), periodEnd: toIsoDate(end) };
    }
    case "ANNUAL": {
      const start = new Date(Date.UTC(year, 0, 1));
      const end = new Date(Date.UTC(year, 11, 31));
      return { periodStart: toIsoDate(start), periodEnd: toIsoDate(end) };
    }
    default: {
      // MONTHLY
      const start = new Date(Date.UTC(year, month, 1));
      const end = new Date(Date.UTC(year, month + 1, 0));
      return { periodStart: toIsoDate(start), periodEnd: toIsoDate(end) };
    }
  }
}
