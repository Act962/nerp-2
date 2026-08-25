import { Badge } from "@/components/ui/badge";
import { currencyFormatter } from "@/utils/currency-formatter";

interface PriceSaleDetailsProps {
  salePrice: number;
  promotionalPrice: number | null;
}

export function PriceSaleDetails({
  salePrice,
  promotionalPrice,
}: PriceSaleDetailsProps) {
  if (promotionalPrice) {
    const calculateDiscount = () => {
      const discount = ((salePrice - promotionalPrice) / salePrice) * 100;
      return discount.toFixed(2);
    };
    return (
      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium line-through">
            R${currencyFormatter(salePrice)}
          </span>
          <Badge className="text-sm font-medium">{calculateDiscount()}%</Badge>
        </div>

        <h1 className="text-4xl font-bold opacity-80 text-green-800">
          R${currencyFormatter(promotionalPrice)}
        </h1>
        <span className="text-sm font-medium text-green-600">
          Você economiza R${currencyFormatter(salePrice - promotionalPrice)}
        </span>
      </div>
    );
  }
  return (
    <div>
      <h1 className="text-4xl font-bold opacity-80 text-green-800">
        R${currencyFormatter(salePrice)}
      </h1>
    </div>
  );
}
