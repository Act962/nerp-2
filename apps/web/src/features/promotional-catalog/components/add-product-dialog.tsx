"use client";

import { useState, useDeferredValue, useEffect } from "react";
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SlidersHorizontal } from "lucide-react";
import {
  activeFilterCount,
  type ProductFilters,
} from "@/app/router/promotional-catalog/_product-filters";
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

type SortKey = "name-asc" | "name-desc" | "price-asc" | "price-desc" | "recent";

const SORT_LABELS: Record<SortKey, string> = {
  "name-asc": "Nome (A-Z)",
  "name-desc": "Nome (Z-A)",
  "price-asc": "Menor preço",
  "price-desc": "Maior preço",
  recent: "Mais recentes",
};

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
    promotionalPrice: number | null;
    currentStock: number;
    trackStock: boolean;
    image: string;
  };
  added: boolean;
  saving: boolean;
  // Modo "vincular" (bloco de estilo): sempre permite escolher, mesmo que o
  // produto já esteja no catálogo — o clique (re)liga o produto ao bloco.
  binding: boolean;
  // Multisseleção. Ausente = linha sem caixa de marcação (modo vincular, em que
  // escolher vários não faz sentido).
  selected?: boolean;
  onToggleSelected?: (id: string) => void;
  onAdd: (id: string, prices: { de: number; por: number | null }) => void;
  // Clique na foto → abre o editor (opcional). Ausente = foto não clicável.
  onEditPhoto?: (
    id: string,
    prices: { de: number; por: number | null },
  ) => void;
}

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

// Linha do produto na busca.
//
// Os preços aparecem prontos ("De" riscado, valor em destaque, tarja de
// promoção) e viram campos ao clicar. A edição já existia e continua ali: ela é
// o que permite fixar um preço só para este catálogo na hora de adicionar —
// esconder atrás de um clique tira o ruído de duas caixas de texto por linha
// sem tirar o recurso.
function AddProductRow({
  product,
  added,
  saving,
  binding,
  selected,
  onToggleSelected,
  onAdd,
  onEditPhoto,
}: AddProductRowProps) {
  const [de, setDe] = useState<string>(String(product.salePrice));
  const [por, setPor] = useState<string>(
    product.promotionalPrice != null ? String(product.promotionalPrice) : "",
  );
  const [editing, setEditing] = useState(false);

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

  const promo = product.promotionalPrice;
  const temPromo = promo != null && promo > 0 && promo < product.salePrice;
  const emEstoque = !product.trackStock || product.currentStock > 0;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-2.5 transition-colors",
        selected ? "border-primary/50 bg-primary/5" : "hover:bg-muted/50",
      )}
    >
      <div className="flex items-center gap-3">
        {onToggleSelected && (
          <Checkbox
            checked={!!selected}
            onCheckedChange={() => onToggleSelected(product.id)}
            aria-label={`Selecionar ${product.name}`}
            className="shrink-0"
          />
        )}
        {/* Preview da foto — clique abre o editor do produto (como na Página) */}
        <button
          type="button"
          className="relative size-14 shrink-0 overflow-hidden rounded-md border bg-background"
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

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate font-medium text-sm">{product.name}</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground text-xs">
              SKU: {product.sku || "—"}
            </span>
            <Badge
              variant="outline"
              className={cn(
                "px-1.5 py-0 font-normal text-[10px]",
                emEstoque
                  ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                  : "border-amber-500/40 text-amber-600 dark:text-amber-400",
              )}
            >
              {emEstoque ? "Em estoque" : "Sem estoque"}
            </Badge>
          </div>
        </div>

        {/* Preços: leitura por padrão, clique abre a edição. */}
        <button
          type="button"
          className="flex shrink-0 flex-col items-end rounded px-1.5 py-1 text-right hover:bg-muted"
          title="Ajustar os preços deste catálogo"
          onClick={() => setEditing((v) => !v)}
        >
          {temPromo && (
            <span className="text-muted-foreground text-xs line-through">
              De {brl.format(product.salePrice)}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="font-semibold text-sm tabular-nums">
              {brl.format(temPromo ? (promo as number) : product.salePrice)}
            </span>
            {temPromo && (
              <Badge
                variant="secondary"
                className="px-1.5 py-0 font-normal text-[10px]"
              >
                promo
              </Badge>
            )}
          </span>
        </button>

        <Button
          type="button"
          variant={isAdded ? "secondary" : "default"}
          size="sm"
          className="shrink-0 gap-1.5"
          disabled={isAdded || saving}
          onClick={submit}
        >
          {!isAdded && <Plus className="h-4 w-4" />}
          {isAdded ? "Adicionado" : "Adicionar"}
        </Button>
      </div>

      {editing && !isAdded && (
        <div className="flex items-center gap-3 border-t pt-2 text-muted-foreground text-xs">
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
          <span className="text-[11px]">
            "De" vale só neste catálogo; "Por" grava no cadastro do produto.
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
  // Filtros do diálogo. `onlyActive` nasce LIGADO: a aba por categoria já
  // filtrava ativos, e a busca não — as duas metades do mesmo diálogo
  // discordavam sobre o que existe.
  const [filters, setFilters] = useState<NonNullable<ProductFilters>>({
    onlyActive: true,
  });
  const setFilter = (patch: Partial<NonNullable<ProductFilters>>) =>
    setFilters((f) => ({ ...f, ...patch }));
  const nFiltros = activeFilterCount(filters);
  // Fichas fora do popover: sem elas, o dev liga um filtro, o produto some da
  // busca e parece que o cadastro está errado. Cada uma desliga o seu filtro no
  // lugar — antes era um texto corrido, que dizia o que estava ligado mas
  // obrigava a reabrir o popover para desligar.
  const fichasFiltro: { label: string; clear: () => void }[] = [];
  if (filters.onlyActive)
    fichasFiltro.push({
      label: "Só ativos",
      clear: () => setFilter({ onlyActive: false }),
    });
  if (filters.withImage)
    fichasFiltro.push({
      label: "Com foto",
      clear: () => setFilter({ withImage: false }),
    });
  if (filters.withPromotion)
    fichasFiltro.push({
      label: "Com promoção",
      clear: () => setFilter({ withPromotion: false }),
    });
  if (filters.inOnlineCatalog)
    fichasFiltro.push({
      label: "No catálogo online",
      clear: () => setFilter({ inOnlineCatalog: false }),
    });
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined)
    fichasFiltro.push({
      label: `R$ ${filters.minPrice ?? 0}–${filters.maxPrice ?? "∞"}`,
      clear: () => setFilter({ minPrice: undefined, maxPrice: undefined }),
    });
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
  const [sort, setSort] = useState<SortKey>("name-asc");
  // Guarda o produto inteiro, não só o id: a seleção sobrevive à troca de
  // página, e ao adicionar em lote é preciso o preço de quem já saiu da tela.
  const [selected, setSelected] = useState<
    Map<string, { id: string; salePrice: number }>
  >(new Map());
  const toggleSelected = (id: string, salePrice: number) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else next.set(id, { id, salePrice });
      return next;
    });
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
  }, [deferredSearch, categorySlug, filters, sort, open, reset]);

  const { data, isLoading, isFetching } = useQuery(
    orpc.products.list.queryOptions({
      input: {
        limit: PAGE_SIZE,
        // `search` casa nome OU SKU OU código de barras (EAN).
        search: deferredSearch || undefined,
        category: categorySlug ? [categorySlug] : undefined,
        filters,
        sort,
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

  interface AddEntry {
    id: string;
    salePrice: number;
    prices: { de: number; por: number | null };
  }

  /**
   * Monta UMA mudança de config para todos os produtos de uma vez.
   *
   * Chamar `onConfigChange` em laço não funcionaria: cada chamada parte do
   * `config` que veio por prop, que só é atualizado no render seguinte — o
   * último produto apagaria os anteriores.
   */
  const buildAddChanges = (entries: AddEntry[]): Partial<CatalogConfig> => {
    const ids = entries.map((e) => e.id);
    const changes: Partial<CatalogConfig> = {
      // Set evita id duplicado ao re-adicionar um produto que era fantasma.
      manuallyAddedIds: Array.from(
        new Set([...config.manuallyAddedIds, ...ids]),
      ),
      excludedProductIds: config.excludedProductIds.filter(
        (eid) => !ids.includes(eid),
      ),
    };

    const grupos = config.productGroups ?? [];
    if (grupos.length === 0 && pageProductIds) {
      // Página ainda sem grupo: nasce o "Grupo Geral" com TODOS os produtos
      // dela, para nenhum ficar solto. A partir daí o dev recorta em
      // "Hortifruti", "Mercearia" etc., e cada recorte tira do Geral.
      changes.productGroups = [
        buildGeneralGroup({
          productIds: [...new Set([...pageProductIds, ...ids])],
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
            ? { ...g, productIds: [...new Set([...g.productIds, ...ids])] }
            : g,
        ),
        ids,
        grupoDestino,
      );
    } else {
      // Sem grupo nomeado elegível: mantém a regra de sobra de sempre, produto
      // a produto, encadeando o resultado de cada adoção na próxima.
      let atual = grupos;
      let mudou = false;
      for (const id of ids) {
        const adopted = withProductAdopted(atual, id);
        if (adopted) {
          atual = adopted;
          mudou = true;
        }
      }
      if (mudou) changes.productGroups = atual;
    }

    // "De": preço normal exibido SÓ neste catálogo (override), só se mudou.
    const overrides: Record<string, number> = {};
    for (const e of entries) {
      if (
        Number.isFinite(e.prices.de) &&
        e.prices.de > 0 &&
        e.prices.de !== e.salePrice
      ) {
        overrides[e.id] = e.prices.de;
      }
    }
    if (Object.keys(overrides).length > 0) {
      changes.priceOverrides = {
        ...(config.priceOverrides ?? {}),
        ...overrides,
      };
    }

    return changes;
  };

  const handleAdd = (
    id: string,
    salePrice: number,
    prices: { de: number; por: number | null },
  ) => {
    onConfigChange(buildAddChanges([{ id, salePrice, prices }]));

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

  /**
   * Adiciona todos os selecionados numa tacada.
   *
   * Usa o preço de venda de cada um, sem override: a seleção múltipla existe
   * para velocidade, e pedir "De/Por" de 30 produtos anularia o ganho. Quem
   * precisa ajustar preço adiciona aquele produto pela linha.
   */
  const handleAddSelected = () => {
    const entries = [...selected.values()].map((p) => ({
      id: p.id,
      salePrice: p.salePrice,
      prices: { de: p.salePrice, por: null },
    }));
    if (entries.length === 0) return;
    onConfigChange(buildAddChanges(entries));
    setSelected(new Map());
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
          <DialogTitle className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShoppingBag className="size-5" />
            </span>
            {title ?? "Adicionar produto ao catálogo"}
          </DialogTitle>
        </DialogHeader>
        {/* Destino: com grupos nomeados, o produto vai para o grupo ESCOLHIDO
            em vez de cair sempre no último. Vale para a busca e para a
            aplicação por categoria. */}
        {gruposNomeados.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="shrink-0 text-muted-foreground text-sm">
              Grupo
            </span>
            <Select
              value={grupoDestino ?? ""}
              onValueChange={(v) => setTargetGroupId(v || null)}
            >
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {gruposNomeados.map((g, i) => (
                  <SelectItem key={g.id} value={g.id}>
                    <span className="flex items-center gap-2">
                      {/* A cor do grupo é a mesma da página — é assim que se
                          reconhece o destino sem ler o nome. */}
                      <span
                        className="size-2.5 shrink-0 rounded-full border"
                        style={{ background: g.bgColor ?? "transparent" }}
                      />
                      {g.name?.trim() || `Grupo ${i + 1}`}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <Tabs defaultValue="busca" className="flex flex-col gap-4">
          {onApplyCategories && (
            <TabsList className="grid h-10 w-full grid-cols-2">
              <TabsTrigger value="busca" className="gap-1.5">
                <Search className="size-4" />
                Buscar produto
              </TabsTrigger>
              <TabsTrigger value="categoria" className="gap-1.5">
                <LayoutGrid className="size-4" />
                Por categoria
              </TabsTrigger>
            </TabsList>
          )}
          <TabsContent value="busca" className="mt-0 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-5 text-muted-foreground" />
                <Input
                  className="h-11 pl-10 text-base"
                  placeholder="Buscar por nome, SKU ou código de barras..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-11 shrink-0 gap-1.5">
                    <SlidersHorizontal className="h-4 w-4" />
                    Filtros
                    {nFiltros > 0 && (
                      <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                        {nFiltros}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 p-3">
                  <div className="flex flex-col gap-3">
                    {/* A chave é INVERTIDA de propósito: o padrão é só ativos,
                        então o controle é "incluir inativos". */}
                    <div className="flex items-center justify-between gap-2 text-xs">
                      Incluir produtos inativos
                      <Switch
                        checked={!filters.onlyActive}
                        onCheckedChange={(v) => setFilter({ onlyActive: !v })}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      Somente com foto
                      <Switch
                        checked={!!filters.withImage}
                        onCheckedChange={(v) => setFilter({ withImage: v })}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      Somente com preço promocional
                      <Switch
                        checked={!!filters.withPromotion}
                        onCheckedChange={(v) => setFilter({ withPromotion: v })}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      Somente no Catálogo Online
                      <Switch
                        checked={!!filters.inOnlineCatalog}
                        onCheckedChange={(v) =>
                          setFilter({ inOnlineCatalog: v })
                        }
                      />
                    </div>
                    <div className="h-px bg-border" />
                    <div className="flex items-end gap-2">
                      <div className="flex flex-1 flex-col gap-1 text-[11px] text-muted-foreground">
                        Preço de
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          className="h-8"
                          value={filters.minPrice ?? ""}
                          onChange={(e) =>
                            setFilter({
                              minPrice:
                                e.target.value === ""
                                  ? undefined
                                  : Number(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="flex flex-1 flex-col gap-1 text-[11px] text-muted-foreground">
                        até
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          className="h-8"
                          value={filters.maxPrice ?? ""}
                          onChange={(e) =>
                            setFilter({
                              maxPrice:
                                e.target.value === ""
                                  ? undefined
                                  : Number(e.target.value),
                            })
                          }
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="self-start text-xs"
                      onClick={() => setFilters({})}
                    >
                      Limpar filtros
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Categoria à esquerda, filtros ligados à direita: quem estreitou a
                busca vê o motivo na mesma linha em que escolhe a categoria. */}
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Select
                  value={categorySlug || "__all__"}
                  onValueChange={(v) =>
                    setCategorySlug(v === "__all__" ? "" : v)
                  }
                >
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Todas as categorias" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas as categorias</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.slug}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {fichasFiltro.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-muted-foreground text-xs">
                      Filtros ativos:
                    </span>
                    {fichasFiltro.map((f) => (
                      <button
                        key={f.label}
                        type="button"
                        onClick={f.clear}
                        className="flex items-center gap-1 rounded-full bg-primary/10 py-0.5 pr-1.5 pl-2 text-primary text-xs hover:bg-primary/20"
                        title={`Remover o filtro "${f.label}"`}
                      >
                        {f.label}
                        <X className="size-3" />
                      </button>
                    ))}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 px-2 text-xs"
                      onClick={() => setFilters({})}
                    >
                      <Trash2 className="size-3.5" />
                      Limpar filtros
                    </Button>
                  </div>
                )}
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

            {/* Quantos resultados + ordenação. O total ficava escondido junto da
                paginação, no rodapé: quem filtrava não via o efeito sem rolar
                a lista até o fim. */}
            {data && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                <span className="text-muted-foreground text-sm">
                  <b className="text-foreground">{data.totalCount}</b> produto
                  {data.totalCount !== 1 ? "s" : ""} encontrado
                  {data.totalCount !== 1 ? "s" : ""}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">
                    Ordenar por
                  </span>
                  <Select
                    value={sort}
                    onValueChange={(v) => setSort(v as SortKey)}
                  >
                    <SelectTrigger className="h-8 w-40 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                        <SelectItem key={k} value={k} className="text-xs">
                          {SORT_LABELS[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* `pr-1` reserva o lugar da barra de rolagem: sem isso as linhas
                encostam na borda direita quando a lista cresce, e o respiro fica
                diferente do dos outros lados. */}
            <div className="flex max-h-96 flex-col gap-2 overflow-y-auto pr-1">
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
                    selected={selected.has(p.id)}
                    onToggleSelected={
                      // Modo vincular escolhe UM produto — marcar vários ali não
                      // levaria a lugar nenhum.
                      onPicked || isAdded
                        ? undefined
                        : (id) => toggleSelected(id, p.salePrice)
                    }
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
              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                {/* A contagem de selecionados fica à esquerda, no lugar do total
                    que subiu para o cabeçalho. A seleção atravessa páginas, então
                    ela precisa aparecer mesmo quando a página atual não tem
                    nenhum marcado. */}
                {selected.size > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-primary text-sm">
                      {selected.size} produto{selected.size !== 1 ? "s" : ""}{" "}
                      selecionado{selected.size !== 1 ? "s" : ""}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1.5"
                      onClick={handleAddSelected}
                    >
                      <Plus className="size-4" />
                      Adicionar selecionados
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => setSelected(new Map())}
                    >
                      Limpar
                    </Button>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm">
                    0 produtos selecionados
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!hasPrevious || isFetching}
                    onClick={goPrevious}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Anterior</span>
                  </Button>
                  <span className="text-muted-foreground text-xs">
                    Página {pageIndex} de {totalPages}
                  </span>
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
                filters={filters}
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
