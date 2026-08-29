/**
 * Recorte de datas dos filtros de /vendas.
 *
 * O corte é feito no fuso da LOJA, não em UTC. Em Fortaleza (UTC−3) uma venda
 * das 22h de ontem já é "hoje" em UTC — filtrar por UTC mostraria no dia errado
 * justamente as vendas do fim do expediente, que é quando mais se vende.
 *
 * Mesmo fuso usado pelos alertas e pelos crons (`check-widget-alerts.ts`,
 * `inngest/functions.ts`).
 */

export const STORE_TZ = "America/Fortaleza";

export const SALES_PERIODS = ["today", "week", "month", "all"] as const;
export type SalesPeriod = (typeof SALES_PERIODS)[number];

export function isSalesPeriod(value: unknown): value is SalesPeriod {
  return SALES_PERIODS.includes(value as SalesPeriod);
}

/**
 * Quanto o fuso está deslocado de UTC no instante dado, em milissegundos.
 *
 * Formata o instante na TZ alvo e reinterpreta os componentes como se fossem
 * UTC: a diferença para o instante original é o offset. Funciona sem depender
 * de tabela de fusos própria.
 */
function offsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(instant);

  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);

  // `hour` volta como 24 na virada em `hour12: false`; Date.UTC aceita e
  // normaliza para 0 do dia seguinte, que é o mesmo instante.
  const comoUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );

  return comoUtc - instant.getTime();
}

/** Meia-noite (no fuso da loja) do dia em que `instant` cai. */
function startOfDay(instant: Date, timeZone: string): Date {
  const offset = offsetMs(instant, timeZone);
  // Deslocado, os getters UTC devolvem a hora de parede da loja.
  const parede = new Date(instant.getTime() + offset);
  const meiaNoite = Date.UTC(
    parede.getUTCFullYear(),
    parede.getUTCMonth(),
    parede.getUTCDate(),
  );
  return new Date(meiaNoite - offset);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

/**
 * Intervalo semiaberto `[from, to)` do período, ou `null` para "todos".
 *
 * Semiaberto de propósito: com `to` exclusivo não existe a fresta de um
 * milissegundo que um `lte: 23:59:59.999` deixa passar.
 *
 * A semana começa no DOMINGO, como no calendário pt-BR.
 */
export function periodRange(
  period: SalesPeriod,
  now: Date = new Date(),
  timeZone: string = STORE_TZ,
): { from: Date; to: Date } | null {
  if (period === "all") return null;

  const hoje = startOfDay(now, timeZone);

  if (period === "today") {
    return { from: hoje, to: addDays(hoje, 1) };
  }

  if (period === "week") {
    const offset = offsetMs(now, timeZone);
    const diaDaSemana = new Date(hoje.getTime() + offset).getUTCDay();
    const domingo = addDays(hoje, -diaDaSemana);
    return { from: domingo, to: addDays(domingo, 7) };
  }

  // month
  const offset = offsetMs(now, timeZone);
  const parede = new Date(hoje.getTime() + offset);
  const primeiro = new Date(
    Date.UTC(parede.getUTCFullYear(), parede.getUTCMonth(), 1) - offset,
  );
  const proximoMes = new Date(
    Date.UTC(parede.getUTCFullYear(), parede.getUTCMonth() + 1, 1) - offset,
  );
  return { from: primeiro, to: proximoMes };
}
