import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import type { CartItem } from "../../types/product";

interface ItemRequestedProps extends CartItem {
  quantityInit: number;
  updateQuantity: (productId: string, quantity: string) => void;
  contrastColor: string;
  toggleRemove: (productId: string, quantity: string) => void;
}

export function ItemRequested({
  id,
  name,
  thumbnail,
  quantityInit,
  updateQuantity,
  toggleRemove,
}: ItemRequestedProps) {
  const [quantity, setQuantity] = useState(quantityInit);

  const isDisabled = quantity <= 1;

  function onSubmit(qtd: number) {
    setQuantity(qtd);
    updateQuantity(id, qtd.toString());
  }

  return (
    <div className="flex items-center gap-3 border-b py-3 last:border-b-0">
      <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-white">
        {thumbnail ? (
          <Image
            src={thumbnail}
            alt={name}
            fill
            sizes="56px"
            className="object-contain"
          />
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="line-clamp-2 text-sm leading-snug">{name}</p>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-8 rounded-full text-muted-foreground"
            aria-label="Tirar do pedido"
            onClick={() => toggleRemove(id, quantity.toString())}
          >
            <Trash2 className="size-4" />
          </Button>
          <div className="ml-auto flex items-center rounded-full border">
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-8 rounded-full"
              aria-label="Diminuir"
              onClick={() => onSubmit(quantity - 1)}
              disabled={isDisabled}
            >
              <Minus className="size-4" />
            </Button>
            <span className="min-w-8 text-center font-medium text-sm">
              {quantity}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-8 rounded-full"
              aria-label="Aumentar"
              onClick={() => onSubmit(quantity + 1)}
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
