"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStores } from "@/features/stores/hooks/use-stores";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import type { CatalogConfig, EntitySource } from "../types";
import { matchStoreByName } from "../lib/resolve-entity";
import { ProductNameSearch } from "./product-name-search";

const TYPE_OPTS: { value: EntitySource; label: string }[] = [
  { value: "store", label: "Loja/cliente" },
  { value: "org", label: "Organização" },
  { value: "product", label: "Produto" },
  { value: "user", label: "Usuário" },
  { value: "category", label: "Categoria" },
];

// Seção "Página dinâmica" (aba Layout): liga o modo dinâmico da página e escolhe
// a ENTIDADE vinculada. Textos/etiquetas com `binding` resolvem dela no render.
export function DynamicPageSection({
  config,
  onConfigChange,
  pageName,
  allPagesDynamic,
  onAllPagesDynamic,
}: {
  config: CatalogConfig;
  onConfigChange: (changes: Partial<CatalogConfig>) => void;
  pageName: string;
  allPagesDynamic?: boolean;
  onAllPagesDynamic?: (dynamic: CatalogConfig["dynamic"]) => void;
}) {
  const dynamic = config.dynamic;
  const on = !!dynamic;
  const type: EntitySource = dynamic?.type ?? "store";
  const [storeSearch, setStoreSearch] = useState("");
  const [productName, setProductName] = useState("");
  const { stores } = useStores({ pageSize: 100 });
  const { data: categoryData } = useQuery(
    orpc.categories.listAll.queryOptions(),
  );
  const categories = categoryData?.categories ?? [];

  const autoStore =
    type === "store" && dynamic?.auto !== false && !dynamic?.refId;
  const matched = autoStore ? matchStoreByName(stores, pageName) : undefined;
  const pickedStore = dynamic?.refId
    ? stores.find((s) => s.id === dynamic.refId)
    : undefined;
  const q = storeSearch.trim().toLowerCase();
  const filtered =
    q.length >= 1
      ? stores.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 8)
      : [];

  return (
    <div className="flex flex-col gap-2 rounded-md border p-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="dyn-page" className="text-xs font-medium">
          Página dinâmica
        </Label>
        <Switch
          id="dyn-page"
          checked={on}
          onCheckedChange={(v) =>
            onConfigChange({
              dynamic: v ? { type: "store", auto: true } : undefined,
            })
          }
        />
      </div>

      {/* Aplica/remove o modo dinâmico a TODAS as páginas de uma vez. Loja com
          `auto` casa cada página pelo seu próprio nome. */}
      {onAllPagesDynamic && (
        <div className="flex items-center justify-between border-t pt-2">
          <Label htmlFor="dyn-all" className="text-xs font-medium">
            Todas as páginas dinâmicas
          </Label>
          <Switch
            id="dyn-all"
            checked={allPagesDynamic ?? false}
            onCheckedChange={(v) =>
              onAllPagesDynamic(
                v
                  ? { type, auto: type === "store" ? true : undefined }
                  : undefined,
              )
            }
          />
        </div>
      )}

      {on && (
        <>
          <p className="text-[11px] text-muted-foreground">
            Vincula a página a uma entidade. Textos e etiquetas dinâmicos
            resolvem os dados dela (editor, export e link público).
          </p>

          <div className="flex items-center gap-2">
            <span className="shrink-0 text-[11px] text-muted-foreground">
              Tipo
            </span>
            <Select
              value={type}
              onValueChange={(v) =>
                onConfigChange({
                  dynamic: {
                    type: v as EntitySource,
                    auto: v === "store" ? true : undefined,
                  },
                })
              }
            >
              <SelectTrigger className="h-7 flex-1 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {type === "category" && (
            <Select
              value={dynamic?.refId ?? ""}
              onValueChange={(v) =>
                onConfigChange({ dynamic: { type: "category", refId: v } })
              }
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="Escolha a categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {type === "store" && (
            <div className="flex flex-col gap-1.5">
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={autoStore ? "default" : "outline"}
                  className="h-7 flex-1 text-[11px]"
                  onClick={() =>
                    onConfigChange({
                      dynamic: { type: "store", auto: true, refId: undefined },
                    })
                  }
                >
                  Automático (pelo nome)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={!autoStore ? "default" : "outline"}
                  className="h-7 flex-1 text-[11px]"
                  onClick={() =>
                    onConfigChange({
                      dynamic: {
                        type: "store",
                        auto: false,
                        refId: dynamic?.refId,
                      },
                    })
                  }
                >
                  Escolher loja
                </Button>
              </div>

              {autoStore ? (
                <p
                  className={cn(
                    "text-[11px]",
                    matched ? "text-muted-foreground" : "text-destructive",
                  )}
                >
                  {matched
                    ? `Loja casada: ${matched.name}`
                    : `Sem correspondência para "${pageName}"`}
                </p>
              ) : (
                <>
                  {pickedStore && (
                    <p className="text-[11px] text-muted-foreground">
                      Loja: {pickedStore.name}
                    </p>
                  )}
                  <Input
                    value={storeSearch}
                    onChange={(e) => setStoreSearch(e.target.value)}
                    placeholder="Buscar loja…"
                    className="h-7 text-xs"
                  />
                  {filtered.length > 0 && (
                    <div className="flex flex-col overflow-hidden rounded-md border">
                      {filtered.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className="px-2 py-1 text-left text-xs hover:bg-muted"
                          onClick={() => {
                            onConfigChange({
                              dynamic: {
                                type: "store",
                                auto: false,
                                refId: s.id,
                              },
                            });
                            setStoreSearch("");
                          }}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {type === "product" && (
            <div className="flex flex-col gap-1.5">
              <ProductNameSearch
                value={productName}
                onChange={setProductName}
                onPick={(p) => {
                  onConfigChange({ dynamic: { type: "product", refId: p.id } });
                  setProductName(p.name);
                }}
              />
              {dynamic?.refId && (
                <p className="text-[11px] text-muted-foreground">
                  Produto vinculado.
                </p>
              )}
            </div>
          )}

          {type === "user" && (
            <p className="text-[11px] text-muted-foreground">
              Usa o usuário atual (sessão).
            </p>
          )}
          {type === "org" && (
            <p className="text-[11px] text-muted-foreground">
              Usa a organização do catálogo.
            </p>
          )}
        </>
      )}
    </div>
  );
}
