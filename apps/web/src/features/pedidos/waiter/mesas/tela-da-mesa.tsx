"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { constructUrl } from "@/hooks/use-construct-url";
import { cn } from "@/lib/utils";
import { currencyFormatter } from "@/utils/currency-formatter";
import { Loader2, Minus, Plus, Receipt, Search, X } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import {
  useWaiterCreateOrder,
  useWaiterProducts,
} from "../hooks/use-waiter-pedidos";
import type { MesaDoSalao } from "../hooks/use-mesas";
import { useLiberarMesa, usePedirConta } from "../hooks/use-mesas";

type Produto = {
  id: string;
  name: string;
  thumbnail: string | null;
  salePrice: number;
  prepTimeMinutes: number | null;
  categoryId: string | null;
  categoryName: string | null;
};

type Linha = { quantidade: number; observacao: string };

/**
 * Montagem do pedido da mesa.
 *
 * Busca em cima, categoria em faixa, e o +/− na PRÓPRIA linha do produto. No
 * app que serviu de referência é preciso entrar na categoria para achar o item
 * e sair de lá para adicionar o próximo; aqui o caminho comum é um toque por
 * item, que é o que o dono pediu quando disse "poucos cliques".
 */
export function TelaDaMesa({
  orgSlug,
  attendantId,
  mesa,
  aoVoltar,
}: {
  orgSlug: string;
  attendantId: string;
  mesa: MesaDoSalao;
  aoVoltar: () => void;
}) {
  const { data: produtos } = useWaiterProducts(orgSlug);
  const criar = useWaiterCreateOrder(orgSlug, attendantId);
  const pedirConta = usePedirConta();
  const liberar = useLiberarMesa();

  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState<string | null>(null);
  const [linhas, setLinhas] = useState<Record<string, Linha>>({});
  const [observando, setObservando] = useState<string | null>(null);

  const lista: Produto[] = produtos ?? [];

  const categorias = useMemo(() => {
    const vistas = new Map<string, string>();
    for (const p of lista) {
      if (p.categoryId && p.categoryName)
        vistas.set(p.categoryId, p.categoryName);
    }
    return [...vistas.entries()].map(([id, nome]) => ({ id, nome }));
  }, [lista]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return lista.filter((p) => {
      if (categoria && p.categoryId !== categoria) return false;
      if (termo && !p.name.toLowerCase().includes(termo)) return false;
      return true;
    });
  }, [busca, categoria, lista]);

  const escolhidos = Object.entries(linhas).filter(([, l]) => l.quantidade > 0);
  const totalItens = escolhidos.reduce((s, [, l]) => s + l.quantidade, 0);
  const totalReais = escolhidos.reduce((s, [id, l]) => {
    const produto = lista.find((p) => p.id === id);
    return s + (produto ? produto.salePrice * l.quantidade : 0);
  }, 0);

  const somar = (id: string, delta: number) => {
    setLinhas((atual) => {
      const linha = atual[id] ?? { quantidade: 0, observacao: "" };
      const quantidade = Math.max(0, Math.min(99, linha.quantidade + delta));
      return { ...atual, [id]: { ...linha, quantidade } };
    });
  };

  const enviar = () => {
    criar.mutate(
      {
        orgSlug,
        attendantId,
        tableNumber: `Mesa ${mesa.number}`,
        tableId: mesa.id,
        items: escolhidos.map(([id, linha]) => {
          const produto = lista.find((p) => p.id === id);
          return {
            dishName: produto?.name ?? "Item",
            productId: id,
            quantity: linha.quantidade,
            notes: linha.observacao.trim() || undefined,
          };
        }),
      },
      { onSuccess: () => setLinhas({}) },
    );
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3 p-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-orange-100 text-lg font-bold text-orange-900 dark:bg-orange-950 dark:text-orange-100">
            {mesa.number}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold">
              Mesa {mesa.number}
              {mesa.name ? ` · ${mesa.name}` : ""}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {mesa.total > 0
                ? `R$ ${currencyFormatter(mesa.total).trim()} na conta`
                : "Conta vazia"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-11"
            onClick={aoVoltar}
            aria-label="Voltar para as mesas"
          >
            <X className="size-6" />
          </Button>
        </div>

        <div className="relative px-3 pb-3">
          <Search className="absolute left-6 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Procurar item"
            className="h-12 pl-9 text-base"
          />
        </div>

        {categorias.length > 0 && (
          <div className="flex gap-2 overflow-x-auto px-3 pb-3">
            <Chip ativa={categoria === null} onClick={() => setCategoria(null)}>
              Tudo
            </Chip>
            {categorias.map((c) => (
              <Chip
                key={c.id}
                ativa={categoria === c.id}
                onClick={() => setCategoria(c.id)}
              >
                {c.nome}
              </Chip>
            ))}
          </div>
        )}
      </header>

      <div className="flex-1 pb-40">
        {visiveis.map((produto) => {
          const linha = linhas[produto.id];
          const quantidade = linha?.quantidade ?? 0;

          return (
            <div key={produto.id} className="border-b">
              <div className="flex items-center gap-3 p-3">
                {produto.thumbnail ? (
                  <Image
                    src={constructUrl(produto.thumbnail)}
                    alt=""
                    width={56}
                    height={56}
                    className="size-14 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="size-14 shrink-0 rounded-lg bg-muted" />
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{produto.name}</p>
                  <p className="text-sm text-muted-foreground">
                    R$ {currencyFormatter(produto.salePrice).trim()}
                    {produto.prepTimeMinutes
                      ? ` · ${produto.prepTimeMinutes} min`
                      : ""}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {quantidade > 0 && (
                    <>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-10"
                        onClick={() => somar(produto.id, -1)}
                        aria-label={`Tirar um ${produto.name}`}
                      >
                        <Minus className="size-5" />
                      </Button>
                      <span className="w-6 text-center text-lg font-bold">
                        {quantidade}
                      </span>
                    </>
                  )}
                  <Button
                    size="icon"
                    className="size-10"
                    onClick={() => somar(produto.id, 1)}
                    aria-label={`Adicionar ${produto.name}`}
                  >
                    <Plus className="size-5" />
                  </Button>
                </div>
              </div>

              {quantidade > 0 && (
                <div className="px-3 pb-3 pl-20">
                  {observando === produto.id ? (
                    <Textarea
                      autoFocus
                      value={linha?.observacao ?? ""}
                      maxLength={200}
                      onBlur={() => setObservando(null)}
                      onChange={(e) =>
                        setLinhas((atual) => ({
                          ...atual,
                          [produto.id]: {
                            quantidade: atual[produto.id]?.quantidade ?? 1,
                            observacao: e.target.value,
                          },
                        }))
                      }
                      placeholder="Ex.: sem cebola, ponto da carne"
                      className="min-h-16 text-base"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setObservando(produto.id)}
                      className="text-sm text-muted-foreground underline-offset-2 hover:underline"
                    >
                      {linha?.observacao
                        ? `» ${linha.observacao}`
                        : "+ observação"}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {visiveis.length === 0 && (
          <p className="p-10 text-center text-muted-foreground">
            Nenhum item encontrado.
          </p>
        )}
      </div>

      {/* Acima da barra de seções (64px), senão o botão de enviar some. */}
      <div className="fixed inset-x-0 bottom-16 border-t bg-background p-3">
        {totalItens > 0 ? (
          <Button
            size="lg"
            className="h-14 w-full justify-between text-base"
            disabled={criar.isPending}
            onClick={enviar}
          >
            {criar.isPending ? (
              <>
                <Loader2 className="size-5 animate-spin" />
                Enviando…
              </>
            ) : (
              <>
                <span>
                  {totalItens} {totalItens === 1 ? "item" : "itens"}
                </span>
                <span>Enviar · R$ {currencyFormatter(totalReais).trim()}</span>
              </>
            )}
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="lg"
              className="h-14 flex-1"
              disabled={mesa.itens === 0 || pedirConta.isPending}
              onClick={() => pedirConta.mutate({ id: mesa.id })}
            >
              <Receipt className="size-5" />
              Pedir a conta
            </Button>
            <Button
              variant="secondary"
              size="lg"
              className="h-14 flex-1"
              disabled={mesa.itens === 0 || liberar.isPending}
              onClick={() =>
                liberar.mutate({ id: mesa.id }, { onSuccess: aoVoltar })
              }
            >
              Liberar mesa
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({
  ativa,
  onClick,
  children,
}: {
  ativa: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
        ativa
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-background",
      )}
    >
      {children}
    </button>
  );
}
