export type StatTone = "default" | "positive" | "negative" | "brand";

export interface StatItem {
  value: number;
  label: string;
  tone?: StatTone;
}

const TONE_CLASS: Record<StatTone, string> = {
  default: "text-foreground",
  positive: "text-emerald-500",
  negative: "text-red-500",
  brand: "text-cyan-500",
};

// Fileira de números do topo do perfil (valor colorido em cima, rótulo embaixo),
// como nos mockups do TradeGram.
export function StatRow({ items }: { items: StatItem[] }) {
  return (
    <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col">
          <span
            className={`font-semibold text-2xl tabular-nums ${TONE_CLASS[item.tone ?? "default"]}`}
          >
            {item.value.toLocaleString("pt-BR")}
          </span>
          <span className="text-muted-foreground text-xs">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
