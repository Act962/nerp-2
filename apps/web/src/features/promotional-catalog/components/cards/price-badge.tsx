import { cn } from "@/lib/utils";

interface PriceBadgeProps {
  discount: number | null;
  className?: string;
}

export function PriceBadge({ discount, className }: PriceBadgeProps) {
  if (!discount) return null;
  return (
    <span
      className={cn(
        "bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded",
        className,
      )}
    >
      -{Math.round(discount)}%
    </span>
  );
}

export function formatPrice(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}
