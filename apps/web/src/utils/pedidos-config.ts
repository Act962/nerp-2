export const DEFAULT_PREP_MINUTES = 15; // fallback quando estimatedMinutes é null

export type Urgency = "normal" | "warning" | "overdue";

// Faixas: normal enquanto dentro do estimado; warning até 1.5x; overdue acima.
// Toda a matemática roda no cliente a partir de createdAt/estimatedMinutes.
export function getOrderUrgency(
  createdAtIso: string,
  estimatedMinutes: number | null,
  now: number,
): Urgency {
  const est = (estimatedMinutes ?? DEFAULT_PREP_MINUTES) * 60_000;
  const elapsed = now - new Date(createdAtIso).getTime();
  if (elapsed < est) return "normal";
  if (elapsed < est * 1.5) return "warning";
  return "overdue";
}

export const urgencyStyles: Record<
  Urgency,
  { badge: string; border: string; label: string }
> = {
  normal: {
    badge: "bg-secondary text-secondary-foreground",
    border: "border-border",
    label: "No prazo",
  },
  warning: {
    badge: "bg-amber-500 text-white",
    border: "border-amber-500",
    label: "Atenção",
  },
  overdue: {
    badge: "bg-destructive text-destructive-foreground",
    border: "border-destructive animate-pulse",
    label: "Atrasado",
  },
};
