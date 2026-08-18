const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

// Com o símbolo — para exibição em tabela/PDF. Difere de `currencyFormatter`
// abaixo, que remove o "R$" para campos que já têm o prefixo no layout.
export function formatBRL(value: number) {
  return brl.format(value);
}

export function currencyFormatter(amount: number) {
  const formatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return formatter.replace("R$", "");
}

export function currencyUnformatter(value: string): number {
  const cleanValue = value.replace(/[^\d,]/g, "");
  const normalizedValue = cleanValue.replace(",", ".");
  return Number(normalizedValue) || 0;
}

export function formatCurrencyInput(value: string | undefined): string {
  const numbers = value?.replace(/\D/g, "");
  if (!numbers) return "";
  const amount = Number(numbers) / 100;

  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function parseCurrencyInput(value: string | undefined): number {
  const numbers = value?.replace(/\D/g, "");

  return numbers ? Number(numbers) / 100 : 0;
}

export function parseCurrencyPenny(value: string | undefined): string | null {
  const numbers = value?.replace(/\D/g, "");

  return numbers ? numbers : null;
}
