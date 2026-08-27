"use client";

import { useMemo, useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { orpc } from "@/lib/orpc";
import type { CategoryGroup } from "../lib/apply-category";
import { previewPageCount } from "../lib/apply-category";

// Acima disto a aplicação avisa antes de seguir. Não é um teto: é só o ponto a
// partir do qual vale dizer em quantos arquivos o export vai sair.
const WARN_PAGES = 100;

type CategoryRow = {
  id: string | null;
  slug: string | null;
  name: string;
  total: number;
  remaining: number;
};

interface AddByCategoryProps {
  // Produtos já no catálogo — o que define o "restam N" de cada categoria.
  excludeIds: string[];
  // Capacidade da página atual (ex.: 12), para converter produtos em páginas.
  pageCapacity: number;
  onApply: (groups: CategoryGroup[]) => void;
  onDone: () => void;
}

export function AddByCategory({
  excludeIds,
  pageCapacity,
  onApply,
  onDone,
}: AddByCategoryProps) {
  const queryClient = useQueryClient();
  // Chave da linha: slug, ou "__none__" para o balde sem categoria.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [limitMode, setLimitMode] = useState<"all" | "count">("all");
  const [count, setCount] = useState(String(pageCapacity));
  const [confirming, setConfirming] = useState(false);

  const summary = useQuery(
    orpc.promotionalCatalog.categorySummary.queryOptions({
      input: { excludeIds },
    }),
  );
  const rows: CategoryRow[] = useMemo(() => summary.data ?? [], [summary.data]);
  const keyOf = (r: CategoryRow) => r.slug ?? "__none__";

  const available = rows.filter((r) => r.remaining > 0);
  const allSelected =
    available.length > 0 && available.every((r) => selected.has(keyOf(r)));

  const toggle = (key: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  const perCategory =
    limitMode === "count" ? Math.max(1, Number(count) || 1) : undefined;

  // Prévia: quantos produtos e quantas páginas. Página por categoria, então o
  // arredondamento é POR categoria — somar tudo e dividir daria menos páginas.
  const chosen = rows.filter((r) => selected.has(keyOf(r)) && r.remaining > 0);
  const counts = chosen.map((r) =>
    Math.min(r.remaining, perCategory ?? r.remaining),
  );
  const totalProducts = counts.reduce((sum, n) => sum + n, 0);
  const totalPages = previewPageCount(counts, pageCapacity);
  const exportFiles = Math.ceil(totalPages / 25);

  const apply = useMutation({
    mutationFn: () =>
      orpc.promotionalCatalog.categoryAvailableIds.call({
        keys: chosen.map((r) => r.slug),
        excludeIds,
        limit: perCategory,
      }),
    onSuccess: (data) => {
      if (data.groups.length === 0) {
        toast.info("Nenhum produto novo nessas categorias.");
        return;
      }
      // O toast de sucesso é do editor: é lá que mora o desfazer.
      onApply(data.groups);
      queryClient.invalidateQueries({
        queryKey: orpc.promotionalCatalog.categorySummary.key(),
      });
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });

  const needsWarning = totalPages > WARN_PAGES;
  const busy = apply.isPending;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Produtos que ainda não estão neste catálogo
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          disabled={busy || available.length === 0}
          onClick={() => {
            setConfirming(false);
            setSelected(
              allSelected ? new Set() : new Set(available.map(keyOf)),
            );
          }}
        >
          {allSelected ? "Limpar seleção" : "Selecionar todas"}
        </Button>
      </div>

      <ScrollArea className="h-[240px] rounded-md border">
        {summary.isLoading ? (
          <div className="flex h-[240px] items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="p-4 text-center text-xs text-muted-foreground">
            Nenhum produto ativo cadastrado.
          </p>
        ) : (
          <div className="flex flex-col">
            {rows.map((r) => {
              const key = keyOf(r);
              const esgotada = r.remaining === 0;
              return (
                // biome-ignore lint/a11y/noLabelWithoutControl: o Checkbox é o controle
                <label
                  key={key}
                  className={`flex items-center gap-2.5 border-b px-3 py-2 last:border-b-0 ${
                    esgotada ? "opacity-50" : "cursor-pointer hover:bg-muted/50"
                  }`}
                >
                  <Checkbox
                    checked={selected.has(key)}
                    disabled={esgotada || busy}
                    onCheckedChange={(v) => {
                      setConfirming(false);
                      toggle(key, v === true);
                    }}
                  />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">
                    {r.name}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {esgotada
                      ? "todos já no catálogo"
                      : `${r.remaining} de ${r.total} restantes`}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <div className="flex items-center gap-2">
        <span className="shrink-0 text-xs text-muted-foreground">
          Quantos adicionar
        </span>
        <div className="flex flex-1 gap-1">
          <Button
            type="button"
            size="sm"
            variant={limitMode === "all" ? "default" : "outline"}
            className="h-7 flex-1 text-[11px]"
            disabled={busy}
            onClick={() => setLimitMode("all")}
          >
            Todos os restantes
          </Button>
          <Button
            type="button"
            size="sm"
            variant={limitMode === "count" ? "default" : "outline"}
            className="h-7 flex-1 text-[11px]"
            disabled={busy}
            onClick={() => setLimitMode("count")}
          >
            Quantidade
          </Button>
        </div>
      </div>

      {limitMode === "count" && (
        <div className="flex items-center gap-2">
          <Label htmlFor="cat-count" className="shrink-0 text-xs">
            Por categoria
          </Label>
          <Input
            id="cat-count"
            type="number"
            min={1}
            className="h-8 w-24 text-xs"
            value={count}
            disabled={busy}
            onChange={(e) => {
              setConfirming(false);
              setCount(e.target.value);
            }}
          />
          <span className="text-[11px] text-muted-foreground">
            padrão = capacidade da página ({pageCapacity})
          </span>
        </div>
      )}

      {/* Prévia — o dev vê o que vai acontecer ANTES de aplicar. */}
      <div className="rounded-md bg-muted/50 px-3 py-2 text-xs">
        {chosen.length === 0 ? (
          <span className="text-muted-foreground">
            Escolha ao menos uma categoria.
          </span>
        ) : (
          <span>
            <strong>{chosen.length}</strong> categoria(s) ·{" "}
            <strong>{totalProducts}</strong> produto(s) →{" "}
            <strong>{totalPages}</strong> página(s)
          </span>
        )}
      </div>

      {needsWarning && (
        <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px]">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
          <span>
            Isso criará <strong>{totalPages} páginas</strong>. A edição funciona
            normalmente; o export sairá em{" "}
            <strong>{exportFiles} arquivos</strong> de até 25 páginas.
          </span>
        </div>
      )}

      <Button
        type="button"
        className="w-full"
        disabled={chosen.length === 0 || busy}
        onClick={() => {
          // Aviso é um passo a mais, não um bloqueio: o segundo clique aplica.
          if (needsWarning && !confirming) {
            setConfirming(true);
            return;
          }
          apply.mutate();
        }}
      >
        {busy ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Criando {totalPages} página(s)…
          </>
        ) : needsWarning && !confirming ? (
          `Confirmar ${totalPages} páginas`
        ) : (
          "Aplicar produtos"
        )}
      </Button>
    </div>
  );
}
