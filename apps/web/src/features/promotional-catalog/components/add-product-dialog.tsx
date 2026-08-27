"use client";

import { useState, useDeferredValue, useEffect } from "react";
import { Plus, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { useCursorPagination } from "@/hooks/use-cursor-pagination";
import { constructUrl } from "@/hooks/use-construct-url";
import { ImageIcon } from "lucide-react";
import { useUpdateProductPrice } from "../hooks/use-catalog";
import type { CatalogConfig } from "../types";
import type { CategoryGroup } from "../lib/apply-category";
import { AddByCategory } from "./add-by-category";
import {
  buildGeneralGroup,
  removeFromOtherGroups,
  withProductAdopted,
} from "../lib/group-slices";
import { PAGE_H_VALUES, PAGE_W } from "../lib/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Página pequena: nunca despeja a lista inteira de produtos no diálogo.
const PAGE_SIZE = 8;

interface AddProductDialogProps {
  config: CatalogConfig;
  onConfigChange: (changes: Partial<CatalogConfig>) => void;
  // Modo "vincular": além de adicionar o produto ao catálogo, devolve o id
  // escolhido (ex.: para ligar a um bloco de estilo) e fecha o diálogo.
  onPicked?: (id: string) => void;
  triggerLabel?: string;
  // Classe do botão-gatilho (para alinhar com outros botões, ex.: lado a lado).
  triggerClassName?: string;
  title?: string;
  // Abertura controlada (opcional) — permite abrir o diálogo de fora (ex.: botão
  // "Adicionar produto" do estado de página vazia).
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  // Clique no thumbnail da foto: adiciona o produto (se ainda não estiver) e
  // pede ao pai para abrir o editor daquele produto (igual à aba "Página").
  onEditProduct?: (id: string) => void;
  // Aplicação por categoria (cria as páginas). Ausente = o diálogo não mostra
  // a aba "Por categoria" — é o caso do seletor de produto do bloco de estilo,
  // onde criar páginas não faria sentido.
  onApplyCategories?: (groups: CategoryGroup[]) => void;
  // Capacidade da página atual, para converter produtos em páginas na prévia.
  pageCapacity?: number;
  // Produtos já na página. Serve para criar o "Grupo Geral" contendo todos
  // quando a página ainda não tem grupo nenhum.
  pageProductIds?: string[];
  // Grupo em que o produto deve cair. Ausente = o último, que é a regra de
  // sobra do render. Com grupos nomeados, o diálogo oferece a escolha.
  defaultGroupId?: string | null;
}

interface AddProductRowProps {
  product: {
    id: string;
    name: string;
    sku: string;
    salePrice: number;
    image: string;
  };
  added: boolean;
  saving: boolean;
  // Modo "vincular" (bloco de estilo): sempre permite escolher, mesmo que o
  // produto já esteja no catálogo — o clique (re)liga o produto ao bloco.
  binding: boolean;
  onAdd: (id: string, prices: { de: number; por: number | null }) => void;
  // Clique na foto → abre o editor (opcional). Ausente = foto não clicável.
  onEditPhoto?: (
    id: string,
    prices: { de: number; por: number | null },
  ) => void;
}

// Linha do produto na busca: "De R$ / Por R$" editáveis para adição rápida.
function AddProductRow({
  product,
  added,
  saving,
  binding,
  onAdd,
  onEditPhoto,
}: AddProductRowProps) {
  const [de, setDe] = useState<string>(String(product.salePrice));
  const [por, setPor] = useState<string>("");

  const prices = () => ({
    de: Number(de),
    por: por !== "" ? Number(por) : null,
  });
  const submit = () => onAdd(product.id, prices());

  // No modo vincular o botão nunca é desabilitado por "já adicionado".
  const isAdded = added && !binding;
  const photoSrc = product.image
    ? product.image.startsWith("http")
      ? product.image
      : constructUrl(product.image)
    : null;

  return (
    <div className="flex flex-col gap-1.5 rounded px-2 py-2 hover:bg-muted">
      <div className="flex items-center justify-between gap-2">
        {/* Preview da foto — clique abre o editor do produto (como na Página) */}
        <button
          type="button"
          className="relative size-11 shrink-0 overflow-hidden rounded-md border bg-muted"
          title={onEditPhoto ? "Editar produto (foto/etiqueta)" : product.name}
          disabled={!onEditPhoto}
          onClick={() => onEditPhoto?.(product.id, prices())}
        >
          {photoSrc ? (
            // biome-ignore lint/performance/noImgElement: thumbnail de produto
            <img
              src={photoSrc}
              alt={product.name}
              className="h-full w-full object-contain"
            />
          ) : (
            <ImageIcon className="absolute inset-0 m-auto h-4 w-4 text-muted-foreground/50" />
          )}
        </button>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm">{product.name}</span>
          <span className="text-xs text-muted-foreground">
            {product.sku || "sem SKU"}
          </span>
        </div>
        <Button
          type="button"
          variant={isAdded ? "secondary" : "outline"}
          size="sm"
          className="ml-2 shrink-0"
          disabled={isAdded || saving}
          onClick={submit}
        >
          {isAdded ? "Adicionado" : "Adicionar"}
        </Button>
      </div>

      {!isAdded && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            De R$
            <Input
              type="number"
              min={0}
              step={0.01}
              className="h-7 w-20 text-xs"
              value={de}
              onChange={(e) => setDe(e.target.value)}
            />
          </span>
          <span className="flex items-center gap-1">
            Por R$
            <Input
              type="number"
              min={0}
              step={0.01}
              className="h-7 w-20 text-xs"
              placeholder="promo"
              value={por}
              onChange={(e) => setPor(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </span>
        </div>
      )}
    </div>
  );
}

export function AddProductDialog({
  config,
  onConfigChange,
  onPicked,
  triggerLabel,
  triggerClassName,
  title,
  open: openProp,
  onOpenChange,
  onEditProduct,
  onApplyCategories,
  pageCapacity,
  pageProductIds,
  defaultGroupId,
}: AddProductDialogProps) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (o: boolean) => {
    onOpenChange?.(o);
    if (openProp === undefined) setOpenState(o);
  };
  const [search, setSearch] = useState("");
  // Grupo de destino do produto adicionado. Começa no grupo selecionado na
  // página; sem seleção, no último — que é o que o render já fazia sozinho.
  const gruposNomeados = (config.productGroups ?? []).filter(
    (g) => g.productIds !== undefined,
  );
  const [targetGroupId, setTargetGroupId] = useState<string | null>(null);
  const grupoDestino =
    targetGroupId ??
    defaultGroupId ??
    gruposNomeados[gruposNomeados.length - 1]?.id ??
    null;
  const deferredSearch = useDeferredValue(search);
  // Filtro por categoria (slug). "" = todas.
  const [categorySlug, setCategorySlug] = useState<string>("");
  const priceMutation = useUpdateProductPrice();
  const { cursor, pageIndex, hasPrevious, goNext, goPrevious, reset } =
    useCursorPagination();

  // Categorias da org (para o filtro e o "adicionar todos desta categoria").
  const { data: catData } = useQuery(
    orpc.categories.listAll.queryOptions({ enabled: open }),
  );
  const categories = catData?.categories ?? [];

  // Volta pra 1ª página ao abrir o diálogo, mudar a busca ou a categoria.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset ao mudar busca/categoria/abrir
  useEffect(() => {
    reset();
  }, [deferredSearch, categorySlug, open, reset]);

  const { data, isLoading, isFetching } = useQuery(
    orpc.products.list.queryOptions({
      input: {
        limit: PAGE_SIZE,
        // `search` casa nome OU SKU OU código de barras (EAN).
        search: deferredSearch || undefined,
        category: categorySlug ? [categorySlug] : undefined,
        cursor,
      },
      enabled: open,
      placeholderData: keepPreviousData,
    }),
  );

  // Toggle "adicionar todos os produtos desta categoria": liga = a categoria
  // entra no `categoryFilter` do catálogo (inclui todos os produtos dela).
  const categoryInFilter =
    !!categorySlug && (config.categoryFilter ?? []).includes(categorySlug);
  const toggleWholeCategory = (on: boolean) => {
    if (!categorySlug) return;
    const cur = config.categoryFilter ?? [];
    onConfigChange({
      categoryFilter: on
        ? Array.from(new Set([...cur, categorySlug]))
        : cur.filter((s) => s !== categorySlug),
    });
  };

  const totalPages = data
    ? Math.max(1, Math.ceil(data.totalCount / PAGE_SIZE))
    : 1;

  // "Adicionado" = está em manuallyAddedIds E não foi excluído. Sem o `!excluded`
  // um produto adicionado e depois removido (fantasma) apareceria como já
  // adicionado, sem estar no catálogo — impedindo re-adicioná-lo.
  const alreadyAdded = new Set(config.manuallyAddedIds);
  const excludedSet = new Set(config.excludedProductIds);

  const handleAdd = (
    id: string,
    salePrice: number,
    prices: { de: number; por: number | null },
  ) => {
    const changes: Partial<CatalogConfig> = {
      // Set evita id duplicado ao re-adicionar um produto que era fantasma.
      manuallyAddedIds: Array.from(new Set([...config.manuallyAddedIds, id])),
      excludedProductIds: config.excludedProductIds.filter((eid) => eid !== id),
    };

    const grupos = config.productGroups ?? [];
    if (grupos.length === 0 && pageProductIds) {
      // Página ainda sem grupo: nasce o "Grupo Geral" com TODOS os produtos
      // dela, para nenhum ficar solto. A partir daí o dev recorta em
      // "Hortifruti", "Mercearia" etc., e cada recorte tira do Geral.
      changes.productGroups = [
        buildGeneralGroup({
          productIds: [...new Set([...pageProductIds, id])],
          gridCols: config.gridCols ?? 3,
          gridRows: config.gridRows ?? 4,
          region: config.productGroup,
          pageWidth: PAGE_W,
          pageHeight: PAGE_H_VALUES[config.pageSize],
          padding: {
            top: config.paddingTop,
            right: config.paddingRight,
            bottom: config.paddingBottom,
            left: config.paddingLeft,
          },
        }),
      ];
    } else if (grupoDestino) {
      // Entra no grupo ESCOLHIDO e sai dos demais — sem a saída, ficaria em
      // dois grupos e apareceria duas vezes na página.
      changes.productGroups = removeFromOtherGroups(
        grupos.map((g) =>
          g.id === grupoDestino && g.productIds !== undefined
            ? { ...g, productIds: [...new Set([...g.productIds, id])] }
            : g,
        ),
        [id],
        grupoDestino,
      );
    } else {
      // Sem grupo nomeado elegível: mantém a regra de sobra de sempre.
      const adopted = withProductAdopted(grupos, id);
      if (adopted) changes.productGroups = adopted;
    }

    // "De": preço normal exibido SÓ neste catálogo (override), só se mudou.
    if (
      Number.isFinite(prices.de) &&
      prices.de > 0 &&
      prices.de !== salePrice
    ) {
      changes.priceOverrides = {
        ...(config.priceOverrides ?? {}),
        [id]: prices.de,
      };
    }
    onConfigChange(changes);

    // "Por": preço promocional — grava no cadastro (produto).
    if (prices.por != null && Number.isFinite(prices.por) && prices.por > 0) {
      priceMutation.mutate({ productId: id, promotionalPrice: prices.por });
    }

    // Modo "vincular": devolve o id e fecha (ex.: ligar a um bloco de estilo).
    if (onPicked) {
      onPicked(id);
      setOpen(false);
    }
  };

  // Clique na foto: garante o produto no catálogo e abre o editor dele (aba
  // "Página"). Fecha o diálogo para o editor ficar em foco.
  const handleEditPhoto = onEditProduct
    ? (
        id: string,
        salePrice: number,
        prices: { de: number; por: number | null },
        alreadyAdded: boolean,
      ) => {
        if (!alreadyAdded) handleAdd(id, salePrice, prices);
        onEditProduct(id);
        setOpen(false);
      }
    : undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className={
            triggerClassName ??
            "h-10 w-full gap-1.5 rounded-xl text-[14px] lg:h-9 lg:text-[13px]"
          }
        >
          <Plus className="h-4 w-4" />
          {triggerLabel ?? "Adicionar produto"}
        </Button>
      </DialogTrigger>
      {/* Largura maior: a lista de produtos e a aba por categoria ficavam
          espremidas. Precisa ser `sm:max-w-3xl` — o `DialogContent` base já traz
          `sm:max-w-lg`, e um `max-w-*` sem o mesmo prefixo responsivo perde para
          ele a partir do breakpoint `sm`. */}
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title ?? "Adicionar produto ao catálogo"}</DialogTitle>
        </DialogHeader>
        {/* Destino: com grupos nomeados, o produto vai para o grupo ESCOLHIDO
            em vez de cair sempre no último. Vale para a busca e para a
            aplicação por categoria. */}
        {gruposNomeados.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-xs text-muted-foreground">
              Adicionar no grupo
            </span>
            <select
              value={grupoDestino ?? ""}
              onChange={(e) => setTargetGroupId(e.target.value || null)}
              className="h-8 flex-1 rounded-md border bg-background px-2 text-xs"
            >
              {gruposNomeados.map((g, i) => (
                <option key={g.id} value={g.id}>
                  {g.name?.trim() || `Grupo ${i + 1}`}
                </option>
              ))}
            </select>
          </div>
        )}
        <Tabs defaultValue="busca" className="flex flex-col gap-4">
          {onApplyCategories && (
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="busca" className="text-xs">
                Buscar produto
              </TabsTrigger>
              <TabsTrigger value="categoria" className="text-xs">
                Por categoria
              </TabsTrigger>
            </TabsList>
          )}
          <TabsContent value="busca" className="mt-0 flex flex-col gap-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar por nome, SKU ou código de barras..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>

            {/* Filtro por categoria + adicionar a categoria inteira */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-xs text-muted-foreground">
                  Categoria
                </span>
                <Select
                  value={categorySlug || "__all__"}
                  onValueChange={(v) =>
                    setCategorySlug(v === "__all__" ? "" : v)
                  }
                >
                  <SelectTrigger className="h-8 flex-1 text-xs">
                    <SelectValue placeholder="Todas as categorias" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__" className="text-xs">
                      Todas as categorias
                    </SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.slug} className="text-xs">
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {categorySlug && (
                <div className="flex items-center justify-between rounded-md border px-2 py-1.5">
                  <Label htmlFor="add-whole-category" className="text-xs">
                    Adicionar todos os produtos desta categoria?
                  </Label>
                  <Switch
                    id="add-whole-category"
                    checked={categoryInFilter}
                    onCheckedChange={toggleWholeCategory}
                  />
                </div>
              )}
            </div>

            {/* `pr-1` reserva o lugar da barra de rolagem: sem isso as linhas
                encostam na borda direita quando a lista cresce, e o respiro fica
                diferente do dos outros lados. */}
            <div className="flex max-h-96 flex-col gap-1 overflow-y-auto pr-1">
              {isLoading && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Buscando...
                </p>
              )}
              {!isLoading && data?.products.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Nenhum produto encontrado.
                </p>
              )}
              {data?.products.map((p) => {
                const isAdded =
                  alreadyAdded.has(p.id) && !excludedSet.has(p.id);
                return (
                  <AddProductRow
                    key={p.id}
                    product={p}
                    added={isAdded}
                    saving={priceMutation.isPending}
                    binding={!!onPicked}
                    onAdd={(id, prices) => handleAdd(id, p.salePrice, prices)}
                    onEditPhoto={
                      handleEditPhoto
                        ? (id, prices) =>
                            handleEditPhoto(id, p.salePrice, prices, isAdded)
                        : undefined
                    }
                  />
                );
              })}
            </div>

            {data && data.totalCount > 0 && (
              <div className="flex items-center justify-between gap-2 border-t pt-3">
                <span className="text-xs text-muted-foreground">
                  Página {pageIndex} de {totalPages}
                  <span className="ml-1.5 opacity-60">
                    ({data.totalCount} produto{data.totalCount !== 1 ? "s" : ""}
                    )
                  </span>
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!hasPrevious || isFetching}
                    onClick={goPrevious}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Anterior</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!data.hasNextPage || isFetching}
                    onClick={() => goNext(data.nextCursor)}
                  >
                    <span className="hidden sm:inline">Próxima</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
          {onApplyCategories && (
            <TabsContent value="categoria" className="mt-0">
              <AddByCategory
                excludeIds={config.manuallyAddedIds}
                pageCapacity={pageCapacity ?? 12}
                onApply={onApplyCategories}
                onDone={() => setOpen(false)}
              />
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
