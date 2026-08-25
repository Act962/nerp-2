import { Button } from "@/components/ui/button";
import { Item, ItemContent, ItemDescription } from "@/components/ui/item";
import { Separator } from "@radix-ui/react-separator";
import { Minus, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { CartItem } from "../../types/product";

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
    <Item>
      <ItemContent className="flex flex-row items-center gap-x-2">
        <div className="relative h-15 w-15">
          <Image
            src={thumbnail}
            alt={name}
            fill
            className="object-cover rounded-sm "
          />
        </div>

        <div className="space-y-2">
          <ItemDescription>{name}</ItemDescription>

          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-9 w-9 rounded-none"
              onClick={() => toggleRemove(id, quantity.toString())}
            >
              <Trash2 className="size-4" />
            </Button>

            <Button
              variant="secondary"
              size="icon-sm"
              className="h-9 w-9 rounded-none"
              onClick={() => onSubmit(quantity - 1)}
              disabled={isDisabled}
            >
              <Minus className="size-4" />
            </Button>

            <span className="px-4 font-medium min-w-12 text-center">
              {quantity}
            </span>

            <Button
              variant="ghost"
              size="icon-sm"
              className="h-9 w-9 rounded-none"
              onClick={() => onSubmit(quantity + 1)}
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
      </ItemContent>

      <Separator orientation="horizontal" className="w-full" />
    </Item>
  );
}
