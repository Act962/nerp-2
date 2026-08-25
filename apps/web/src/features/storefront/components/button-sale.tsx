import { Button } from "@/components/ui/button";
import { Check, ShoppingCartIcon, X } from "lucide-react";
import { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonSaleProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  data: {
    productIsDisponile: boolean;
    showAsInCart: boolean;
  };
}

export function ButtonSale({ data, ...props }: ButtonSaleProps): ReactNode {
  if (!data.productIsDisponile) {
    return (
      <Button variant="destructive" disabled {...props}>
        <X className="size-4" />
        Indisponível
      </Button>
    );
  }

  return (
    <Button {...props}>
      {data.showAsInCart ? (
        <Check className="size-4" />
      ) : (
        <ShoppingCartIcon className="size-4" />
      )}
      {data.showAsInCart ? "Adicionado" : "Adicionar"}
    </Button>
  );
}
