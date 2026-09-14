"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { constructUrl } from "@/hooks/use-construct-url";
import { currencyFormatter } from "@/utils/currency-formatter";
import { Minus, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { preco } from "./menu-view";

type Produto = {
  id: string;
  name: string;
  thumbnail: string;
  salePrice: number;
  promotionalPrice: number | null;
};

type Props = {
  produto: Produto | null;
  aberto: boolean;
  aoFechar: () => void;
  noCarrinho: { quantity: string; notes?: string } | null;
  aoAdicionar: (quantidade: number, observacao?: string) => void;
  aoRemover: () => void;
};

/** A folha do item: foto, quantidade e o campo que a cozinha vai ler. */
export function ItemSheet({
  produto,
  aberto,
  aoFechar,
  noCarrinho,
  aoAdicionar,
  aoRemover,
}: Props) {
  const [quantidade, setQuantidade] = useState(1);
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    if (!aberto) return;
    setQuantidade(Number(noCarrinho?.quantity) || 1);
    setObservacao(noCarrinho?.notes ?? "");
  }, [aberto, noCarrinho?.quantity, noCarrinho?.notes]);

  if (!produto) return null;

  const unitario = preco(produto);

  return (
    <Sheet open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto">
        <SheetHeader className="p-0">
          <SheetTitle className="sr-only">{produto.name}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-5 p-4">
          {produto.thumbnail && (
            <Image
              src={constructUrl(produto.thumbnail)}
              alt=""
              width={640}
              height={360}
              className="h-52 w-full rounded-xl object-cover"
            />
          )}

          <div>
            <p className="text-2xl font-bold">{produto.name}</p>
            <p className="text-xl font-semibold text-muted-foreground">
              R$ {currencyFormatter(unitario).trim()}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="observacao" className="text-base font-medium">
              Alguma observação?
            </label>
            <Textarea
              id="observacao"
              value={observacao}
              maxLength={200}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex.: sem cebola, ponto da carne ao ponto"
              className="min-h-20 text-base"
            />
          </div>

          <div className="flex items-center justify-center gap-6">
            <Button
              variant="outline"
              size="icon"
              className="size-14 rounded-full"
              aria-label="Diminuir"
              onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
            >
              <Minus className="size-6" />
            </Button>
            <span className="w-10 text-center text-3xl font-bold">
              {quantidade}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-14 rounded-full"
              aria-label="Aumentar"
              onClick={() => setQuantidade((q) => Math.min(99, q + 1))}
            >
              <Plus className="size-6" />
            </Button>
          </div>

          <Button
            size="lg"
            className="h-14 justify-between text-base"
            onClick={() =>
              aoAdicionar(quantidade, observacao.trim() || undefined)
            }
          >
            <span>{noCarrinho ? "Atualizar" : "Adicionar"}</span>
            <span>R$ {currencyFormatter(unitario * quantidade).trim()}</span>
          </Button>

          {noCarrinho && (
            <Button
              variant="ghost"
              className="text-destructive"
              onClick={aoRemover}
            >
              <Trash2 className="size-5" />
              Tirar da sacola
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
