// Aceita o formato brasileiro (milhar com ponto, decimal com vírgula) e
// também "R$", espaços etc — usado tanto no parser da planilha quanto nos
// campos de Meta/Vendido editados manualmente.
export function parseBrlAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/[^\d,.-]/g, "");
  if (!cleaned) return null;
  const normalized = cleaned.replace(/\./g, "").replace(",", ".");
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

export function formatBrlAmountInput(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Sem casas decimais quando o valor é inteiro — economiza espaço em cards
// compactos sem perder precisão quando há centavos de fato.
export function formatBrlCompact(value: number): string {
  const hasCents = !Number.isInteger(value);
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  });
}
