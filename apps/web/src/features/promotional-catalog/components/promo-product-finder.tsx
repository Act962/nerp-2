"use client";

import { useMemo, useState } from "react";
import { ImageIcon, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { constructUrl } from "@/hooks/use-construct-url";
import { formatBRL } from "@/utils/currency-formatter";
import { normalizeName } from "../lib/product-match";

// Busca de produto no link PÚBLICO do catálogo.
//
// Um encarte com dezenas de páginas se lê rolando, e quem procura um item
// específico não tem por onde. O botão flutuante abre a mesma lista do diálogo
// "Adicionar produto ao catálogo" — mesma linha, mesma busca —, só que aqui
// nada é adicionado: o botão LEVA até a página onde o produto está.

export interface FindableProduct {
  id: string;
  name: string;
  sku: string;
  /** Chave R2 ou URL completa. */
  thumbnail: string;
  price: number;
  /** Índice da página no render — é o que volta no `onOpen`. */
  pageIndex: number;
  pageLabel: string;
}

interface PromoProductFinderProps {
  products: FindableProduct[];
  onOpen: (pageIndex: number) => void;
}

/** Acima disso rolar deixa de ajudar e o campo de busca é o caminho melhor. */
const MAX_ROWS = 80;

export function PromoProductFinder({
  products,
  onOpen,
}: PromoProductFinderProps) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");

  // `normalizeName` tira acento e caixa dos dois lados — procurar "cafe" acha
  // "CAFÉ". É a mesma normalização que casa planilha com cadastro.
  const alvo = normalizeName(busca);
  const encontrados = useMemo(
    () =>
      alvo
        ? products.filter(
            (p) =>
              normalizeName(p.name).includes(alvo) ||
              normalizeName(p.sku).includes(alvo),
          )
        : products,
    [alvo, products],
  );
  const visiveis = encontrados.slice(0, MAX_ROWS);

  // Fecha e avisa no mesmo clique. Quem rola é o pai, que insiste até a trava
  // de scroll do Radix sair — não dá para esperar um evento de fechamento:
  // `onCloseAutoFocus` não dispara quando o diálogo fecha por estado.
  const abrir = (pageIndex: number) => {
    setOpen(false);
    onOpen(pageIndex);
  };

  if (products.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="icon"
          className="fixed right-4 bottom-4 z-40 size-14 rounded-full shadow-xl"
          aria-label="Buscar produto no catálogo"
          title="Buscar produto no catálogo"
        >
          <Search className="size-6" />
        </Button>
      </DialogTrigger>

      <DialogContent className="flex max-h-[85dvh] flex-col gap-3 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Buscar produto</DialogTitle>
          <DialogDescription>
            "Abrir" leva até a página do catálogo onde o produto está.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
          <Input
            className="h-10 pl-9"
            placeholder="Buscar por nome ou SKU..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        {/* Rolagem em `div` simples, não no `ScrollArea`: o viewport do Radix
            envolve o conteúdo num `display: table`, que dimensiona pelo
            conteúdo — a linha ficava mais larga que a caixa e o "Abrir" saía
            pela direita, cortado. */}
        <div className="h-[50dvh] overflow-y-auto rounded-md border">
          {visiveis.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground text-sm">
              Nenhum produto com “{busca}”.
            </p>
          ) : (
            <div className="flex flex-col divide-y">
              {visiveis.map((p) => (
                <FinderRow
                  // O mesmo produto pode estar em mais de uma página; a chave
                  // carrega a página para as duas linhas coexistirem.
                  key={`${p.id}-${p.pageIndex}`}
                  product={p}
                  onOpen={abrir}
                />
              ))}
            </div>
          )}
        </div>

        {encontrados.length > visiveis.length && (
          <p className="text-center text-muted-foreground text-xs">
            Mostrando {visiveis.length} de {encontrados.length} — refine a
            busca.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FinderRow({
  product,
  onOpen,
}: {
  product: FindableProduct;
  onOpen: (pageIndex: number) => void;
}) {
  const src = product.thumbnail
    ? product.thumbnail.startsWith("http")
      ? product.thumbnail
      : constructUrl(product.thumbnail)
    : null;

  return (
    <div className="flex items-center gap-3 p-2.5">
      <div className="relative size-12 shrink-0 overflow-hidden rounded-md border bg-background">
        {src ? (
          // biome-ignore lint/performance/noImgElement: thumbnail de produto
          <img
            src={src}
            alt=""
            className="h-full w-full object-contain"
            loading="lazy"
          />
        ) : (
          <ImageIcon className="absolute inset-0 m-auto size-4 text-muted-foreground/50" />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-medium text-sm">{product.name}</span>
        {/* Uma linha só, com o rótulo da página encolhendo: nome de página
            dinâmica é o nome do cliente e passa fácil da largura do diálogo —
            sem truncar, empurrava o "Abrir" para fora da área visível. */}
        <div className="flex min-w-0 items-center gap-1.5">
          <Badge
            variant="outline"
            // `justify-start`: o Badge centraliza o conteúdo, e com overflow
            // escondido isso corta o rótulo dos DOIS lados ("ágina 1 · RMC…").
            className="min-w-0 shrink justify-start truncate px-1.5 py-0 font-normal text-[10px]"
          >
            {product.pageLabel}
          </Badge>
          {product.price > 0 && (
            <span className="shrink-0 text-muted-foreground text-xs">
              {formatBRL(product.price)}
            </span>
          )}
        </div>
      </div>

      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="shrink-0"
        onClick={() => onOpen(product.pageIndex)}
      >
        Abrir
      </Button>
    </div>
  );
}
