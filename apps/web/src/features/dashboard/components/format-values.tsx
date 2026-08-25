import { ArrowDownRight, ArrowUpRight, Minus, Plus } from "lucide-react";
import { ReactNode } from "react";

interface FormatMessageTotalSalesProps {
  value: number;
}
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

export const FormatMessageTotalSales = ({
  value,
}: FormatMessageTotalSalesProps): ReactNode => {
  if (value > 0) {
    return (
      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
        <ArrowUpRight className="h-3 w-3 text-green-500" />
        <span className="text-green-500">+{formatCurrency(value)}</span> desde o
        mês passado
      </div>
    );
  }
  return (
    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
      <ArrowDownRight className="h-3 w-3 text-red-500" />
      <span className="text-red-500">-{formatCurrency(value)}</span> desde o mês
      passado
    </div>
  );
};

interface FormatMessageSalesTodayProps {
  value: number;
}

export const FormatMessageSalesToday = ({
  value,
}: FormatMessageSalesTodayProps): ReactNode => {
  if (value >= 0) {
    return (
      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
        <ArrowUpRight className="h-3 w-3 text-green-500" />
        <span className="text-green-500">
          {value === 0 ? "+" : null}
          {value}
        </span>{" "}
        em relação a ontem
      </div>
    );
  }
  return (
    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
      <ArrowDownRight className="h-3 w-3 text-red-500" />
      <span className="text-red-500">-{value}</span> desde ontem
    </div>
  );
};
