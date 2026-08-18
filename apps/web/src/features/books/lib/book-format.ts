import type { BookStatus } from "@/generated/prisma/enums";

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function formatPeriod(month: number, year: number) {
  const name = MONTH_NAMES[month - 1] ?? String(month);
  return `${name} / ${year}`;
}

interface StatusMeta {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
}

export const BOOK_STATUS_META: Record<BookStatus, StatusMeta> = {
  DRAFT: { label: "Rascunho", variant: "secondary" },
  GENERATING: { label: "Gerando", variant: "outline" },
  READY: { label: "Pronto", variant: "default" },
  FAILED: { label: "Falhou", variant: "destructive" },
};
