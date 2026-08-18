const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Formata um valor em CENTAVOS como moeda pt-BR, ex.: 123456 → "R$ 1.234,56". */
export function formatCents(cents: number): string {
  return brl.format((cents ?? 0) / 100);
}

/** Converte centavos (Int da API) para reais (número decimal). */
export function centsToReais(cents: number): number {
  return (cents ?? 0) / 100;
}

/** Converte reais digitados pelo usuário para centavos, arredondando. */
export function reaisToCents(reais: number): number {
  return Math.round((reais ?? 0) * 100);
}

/**
 * Formata uma data ISO em pt-BR SEM deslocar o dia pelo fuso. Vencimentos são
 * datas "de calendário" gravadas à meia-noite UTC; formatar no fuso local
 * (ex.: UTC-3) mostraria o dia anterior. Fixamos timeZone UTC.
 */
export function formatDate(
  iso: string,
  opts?: Intl.DateTimeFormatOptions,
): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    ...opts,
  });
}
