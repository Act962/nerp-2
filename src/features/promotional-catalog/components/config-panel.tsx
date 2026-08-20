"use client";

import { Fragment, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChevronDown,
  ChevronUp,
  X,
  CaseSensitive,
  Bold,
  Tag,
  Building2,
  Image as ImageIcon,
  Loader2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Minus,
  Plus,
  Search,
  Wand2,
  RotateCcw,
  Trash2,
  Save,
  Upload,
  Sticker,
  RefreshCw,
  CopyPlus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ColorPickerField } from "./color-picker-field";
import { AddProductDialog } from "./add-product-dialog";
import { BackgroundImageUploader } from "./background-image-uploader";
import {
  useCatalogAssets,
  useCatalogTemplates,
  useCreateCatalog,
  useCreateCatalogAsset,
  useCreateCatalogTemplate,
  useUpdateCatalogTemplate,
  useDeleteCatalogAsset,
  useDeleteCatalogTemplate,
  useRemoveProductBackground,
  useSearchProductImages,
  useSetProductThumbnail,
  useSetProductThumbnailFromUrl,
  useSetProductUnit,
  useUpdateProductPrice,
} from "../hooks/use-catalog";
import { imageStyleFromAdjust } from "./cards/image-style";
import { ROCKET_SAMPLE } from "./cards/rocket-sample";
import { useSupplier } from "@/features/supplier/hooks/use-supplier";
import { constructUrl } from "@/hooks/use-construct-url";
import type { ProductUnit } from "@/generated/prisma/enums";
import {
  type CatalogConfig,
  type CatalogProduct,
  DEFAULT_IMAGE_ADJUSTMENT,
  DEFAULT_PRICE_STYLE,
  type ImageAdjustment,
  type PriceStyle,
  toTemplateConfig,
} from "../types";

const UNIT_OPTIONS: { value: ProductUnit; label: string }[] = [
  { value: "UN", label: "Unidade (un)" },
  { value: "KG", label: "Quilograma (kg)" },
  { value: "G", label: "Grama (g)" },
  { value: "L", label: "Litro (L)" },
  { value: "ML", label: "Mililitro (mL)" },
  { value: "CX", label: "Caixa (cx)" },
  { value: "PC", label: "Peça (pç)" },
  { value: "M", label: "Metro (m)" },
  { value: "M2", label: "Metro² (m²)" },
  { value: "M3", label: "Metro³ (m³)" },
  { value: "PAR", label: "Par" },
  { value: "DZ", label: "Dúzia (dz)" },
];

const STYLE_LABELS: Record<PriceStyle["variant"], string> = {
  plain: "Sem borda",
  boxed: "Com borda",
  highlight: "Destaque",
};

// Seção retrátil (accordion) usada na aba "Layout". Controlada: abrir uma
// fecha as outras (o estado de qual está aberta vive no ConfigPanel).
function CollapsibleSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {title}
        <ChevronDown
          className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="flex flex-col gap-3 border-t p-3">{children}</div>
      )}
    </div>
  );
}

// Divisor/título de um subgrupo dentro de uma seção retrátil.
function SubGroupLabel({ children }: { children: ReactNode }) {
  return (
    <p className="-mx-3 mt-1 border-t px-3 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

const CARD_STYLES: {
  value: CatalogConfig["cardStyle"];
  label: string;
  hint: string;
}[] = [
  { value: "standard", label: "Padrão", hint: "Foto em cima, texto embaixo" },
  { value: "minimal", label: "Minimalista", hint: "Só foto, nome e preço" },
  { value: "compact", label: "Compacto", hint: "Foto pequena à esquerda" },
  { value: "list", label: "Lista", hint: "Linha com preço à direita" },
];

// Produto de exemplo mostrado nas miniaturas de estilo de card.
const SAMPLE_NAME = "NAVE ESPACIAL ÓRBITA";
const SAMPLE_PRICE = "R$ 1.000.000,00";

function RocketImg({ className }: { className?: string }) {
  return (
    // biome-ignore lint/performance/noImgElement: mockup estático em data URI
    <img
      src={ROCKET_SAMPLE}
      alt=""
      className={cn("object-contain", className)}
      draggable={false}
    />
  );
}

// Preço em caixa destacada (como a variante "highlight" do card real).
function PricePill({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block self-start rounded-[3px] bg-red-600 px-1 py-0.5 font-bold leading-none text-white",
        className,
      )}
    >
      {SAMPLE_PRICE}
    </span>
  );
}

// Mockup em miniatura de cada estilo de card — renderiza um mini-card REAL com o
// produto de exemplo (foguete + nome + preço), mostrando a disposição de cada
// layout como ficaria de verdade.
function CardStyleThumb({ variant }: { variant: CatalogConfig["cardStyle"] }) {
  const nameCls = "line-clamp-2 font-medium leading-[1.15] text-foreground";

  if (variant === "compact") {
    return (
      <div className="flex h-full items-center gap-1.5 rounded bg-card p-1.5">
        <div className="flex size-12 shrink-0 items-center justify-center rounded bg-muted">
          <RocketImg className="h-full" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
          <p className={cn(nameCls, "text-[6px]")}>{SAMPLE_NAME}</p>
          <PricePill className="text-[8px]" />
        </div>
      </div>
    );
  }
  if (variant === "list") {
    return (
      <div className="flex h-full items-center gap-1.5 rounded bg-card p-1.5">
        <div className="flex size-12 shrink-0 items-center justify-center rounded bg-muted">
          <RocketImg className="h-full" />
        </div>
        <p className={cn(nameCls, "flex-1 text-[6px]")}>{SAMPLE_NAME}</p>
        <PricePill className="shrink-0 text-[6px]" />
      </div>
    );
  }
  if (variant === "minimal") {
    return (
      <div className="flex h-full flex-col items-start rounded bg-card p-1">
        <div className="flex w-full flex-1 items-center justify-center overflow-hidden">
          <RocketImg className="h-full" />
        </div>
        <p className={cn(nameCls, "text-[6px]")}>{SAMPLE_NAME}</p>
        <PricePill className="mt-0.5 text-[8px]" />
      </div>
    );
  }
  // standard: foto com selo de desconto no canto, nome e faixa de preço
  return (
    <div className="flex h-full flex-col overflow-hidden rounded border bg-card">
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-muted p-0.5">
        <RocketImg className="h-full" />
        <span className="absolute left-0.5 top-0.5 rounded-[2px] bg-red-600 px-0.5 text-[5px] font-bold leading-tight text-white">
          -15%
        </span>
      </div>
      <div className="flex flex-col items-start gap-0.5 p-1">
        <p className={cn(nameCls, "text-[6px]")}>{SAMPLE_NAME}</p>
        <PricePill className="text-[8px]" />
      </div>
    </div>
  );
}

// Foto do produto: enviar do computador OU buscar na web (IA). Ambos gravam a
// thumbnail NO CADASTRO (produto real) — reflete no catálogo e onde mais usar.
function ProductPhotoButton({
  product,
  config,
  onConfigChange,
}: {
  product: CatalogProduct;
  config: CatalogConfig;
  onConfigChange: (changes: Partial<CatalogConfig>) => void;
}) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, isPending: uploading } = useSetProductThumbnail();
  const search = useSearchProductImages();
  const fromUrl = useSetProductThumbnailFromUrl();
  const removeBg = useRemoveProductBackground();
  const [results, setResults] = useState<string[]>([]);
  const [broken, setBroken] = useState<Set<string>>(new Set());

  // Redimensionar/cortar NÃO-destrutivo por produto (só exibição no catálogo).
  const adjust =
    config.imageAdjustments?.[product.id] ?? DEFAULT_IMAGE_ADJUSTMENT;
  const isAdjusted =
    config.imageAdjustments?.[product.id] != null &&
    (adjust.scale !== 1 ||
      adjust.posX !== 50 ||
      adjust.posY !== 50 ||
      adjust.fit !== "cover");
  const setAdjust = (patch: Partial<ImageAdjustment>) =>
    onConfigChange({
      imageAdjustments: {
        ...(config.imageAdjustments ?? {}),
        [product.id]: { ...adjust, ...patch },
      },
    });
  const resetAdjust = () => {
    const next = { ...(config.imageAdjustments ?? {}) };
    delete next[product.id];
    onConfigChange({ imageAdjustments: next });
  };

  const runSearch = () => {
    setResults([]);
    setBroken(new Set());
    search.mutate(
      { productId: product.id },
      { onSuccess: (data) => setResults(data.images) },
    );
  };

  const applyUrl = (url: string) =>
    fromUrl.mutate(
      { productId: product.id, url },
      { onSuccess: () => setOpen(false) },
    );

  const visible = results.filter((u) => !broken.has(u));

  return (
    <>
      {/* Thumbnail alto (topo do nome à base do "De/Por"): mostra a foto atual
          do produto; clicar segue o fluxo normal (enviar / buscar na web). */}
      <button
        type="button"
        className="relative w-14 shrink-0 self-stretch overflow-hidden rounded border bg-muted flex items-center justify-center transition-opacity hover:opacity-80"
        title="Foto do produto (enviar ou buscar na web)"
        disabled={uploading}
        onClick={() => setOpen(true)}
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : product.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={constructUrl(product.thumbnail)}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <ImageIcon className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="truncate pr-6 text-base">
              Foto — {product.name}
            </DialogTitle>
          </DialogHeader>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file)
                upload(product.id, file, { onSuccess: () => setOpen(false) });
              e.target.value = "";
            }}
          />

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              Enviar do computador
            </Button>
            <Button
              type="button"
              size="sm"
              className="flex-1 gap-1"
              disabled={search.isPending}
              onClick={runSearch}
            >
              {search.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Search className="h-3.5 w-3.5" />
              )}
              Buscar na web (IA)
            </Button>
          </div>

          {search.isPending && (
            <p className="text-center text-xs text-muted-foreground">
              Buscando imagens reais do produto…
            </p>
          )}

          {visible.length > 0 && (
            <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto">
              {visible.map((url) => (
                <button
                  key={url}
                  type="button"
                  disabled={fromUrl.isPending}
                  onClick={() => applyUrl(url)}
                  className="group relative aspect-square overflow-hidden rounded border bg-muted disabled:opacity-50"
                  title="Usar esta imagem"
                >
                  {/* biome-ignore lint/performance/noImgElement: URL externa arbitrária (resultado de busca) */}
                  <img
                    src={url}
                    alt=""
                    className="size-full object-contain"
                    onError={() => setBroken((prev) => new Set(prev).add(url))}
                  />
                  <span className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                    {fromUrl.isPending ? "Salvando…" : "Usar"}
                  </span>
                </button>
              ))}
            </div>
          )}

          {search.isSuccess && !search.isPending && visible.length === 0 && (
            <p className="text-center text-xs text-muted-foreground">
              Nenhuma imagem encontrada. Tente enviar do computador.
            </p>
          )}

          {product.thumbnail && (
            <>
              {/* Remover fundo — grava no cadastro (motor do planograma) */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full gap-1"
                disabled={removeBg.isPending}
                onClick={() => removeBg.mutate({ productId: product.id })}
              >
                {removeBg.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Wand2 className="h-3.5 w-3.5" />
                )}
                Remover fundo
              </Button>

              {/* Redimensionar e cortar — só exibição neste catálogo */}
              <div className="flex flex-col gap-3 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold">
                    Redimensionar e cortar
                  </p>
                  {isAdjusted && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      onClick={resetAdjust}
                    >
                      <RotateCcw className="h-3 w-3" />
                      Restaurar
                    </Button>
                  )}
                </div>

                <div className="relative mx-auto aspect-square w-40 overflow-hidden rounded border bg-muted">
                  {/* biome-ignore lint/performance/noImgElement: preview local do ajuste */}
                  <img
                    src={constructUrl(product.thumbnail)}
                    alt={product.name}
                    className="absolute inset-0 h-full w-full"
                    style={imageStyleFromAdjust(adjust)}
                  />
                </div>

                <div className="flex gap-1">
                  {(
                    [
                      ["cover", "Cobrir"],
                      ["contain", "Caber"],
                    ] as const
                  ).map(([v, label]) => (
                    <Button
                      key={v}
                      type="button"
                      size="sm"
                      variant={adjust.fit === v ? "default" : "outline"}
                      className="flex-1 text-[11px]"
                      onClick={() => setAdjust({ fit: v })}
                    >
                      {label}
                    </Button>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    Zoom
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() =>
                        setAdjust({
                          scale: Math.max(
                            0.5,
                            Math.round((adjust.scale - 0.1) * 10) / 10,
                          ),
                        })
                      }
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-9 text-center text-[11px] tabular-nums">
                      {Math.round(adjust.scale * 100)}%
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() =>
                        setAdjust({
                          scale: Math.min(
                            3,
                            Math.round((adjust.scale + 0.1) * 10) / 10,
                          ),
                        })
                      }
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-muted-foreground">
                    Posição horizontal
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={adjust.posX}
                    onChange={(e) =>
                      setAdjust({ posX: Number(e.target.value) })
                    }
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-muted-foreground">
                    Posição vertical
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={adjust.posY}
                    onChange={(e) =>
                      setAdjust({ posY: Number(e.target.value) })
                    }
                  />
                </label>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// Edição rápida De/Por direto na lista — mesmos campos do "Adicionar produto".
// De = preço normal só deste catálogo (override na config). Por = preço
// promocional, gravado no cadastro do produto.
function ProductInlinePrices({
  product,
  config,
  onConfigChange,
}: {
  product: CatalogProduct;
  config: CatalogConfig;
  onConfigChange: (changes: Partial<CatalogConfig>) => void;
}) {
  const mutation = useUpdateProductPrice();
  const basePrice = product.basePrice ?? product.salePrice;
  const override = config.priceOverrides?.[product.id];

  const [de, setDe] = useState<string>(String(override ?? basePrice));
  const [por, setPor] = useState<string>(
    product.promotionalPrice != null ? String(product.promotionalPrice) : "",
  );

  const applyDe = () => {
    const num = de !== "" ? Number(de) : Number.NaN;
    const next = { ...(config.priceOverrides ?? {}) };
    if (Number.isFinite(num) && num > 0 && num !== basePrice)
      next[product.id] = num;
    else delete next[product.id];
    onConfigChange({ priceOverrides: next });
  };

  const applyPor = () => {
    const num = por !== "" ? Number(por) : Number.NaN;
    mutation.mutate({
      productId: product.id,
      promotionalPrice: Number.isFinite(num) && num > 0 ? num : null,
    });
  };

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="flex items-center gap-1">
        De R$
        <Input
          type="number"
          min={0}
          step={0.01}
          className="h-7 w-20 text-xs"
          value={de}
          onChange={(e) => setDe(e.target.value)}
          onBlur={applyDe}
          onKeyDown={(e) => e.key === "Enter" && applyDe()}
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
          onBlur={applyPor}
          onKeyDown={(e) => e.key === "Enter" && applyPor()}
        />
      </span>
    </div>
  );
}

// Popover de opções avançadas do preço: unidade + destaque (estilo). Os valores
// De/Por ficam inline na lista (ProductInlinePrices).
function ProductStylePopover({
  product,
  config,
  onConfigChange,
}: {
  product: CatalogProduct;
  config: CatalogConfig;
  onConfigChange: (changes: Partial<CatalogConfig>) => void;
}) {
  // Unidade: salva no cadastro (produto real).
  const unitMutation = useSetProductUnit();

  // Estilo do preço: override por produto (live) + "aplicar a todos".
  const effStyle =
    config.priceStyleOverrides?.[product.id] ??
    config.priceStyle ??
    DEFAULT_PRICE_STYLE;

  const setStyle = (patch: Partial<PriceStyle>) => {
    const next = { ...(config.priceStyleOverrides ?? {}) };
    next[product.id] = { ...effStyle, ...patch };
    onConfigChange({ priceStyleOverrides: next });
  };

  const applyStyleToAll = () => {
    onConfigChange({ priceStyle: effStyle, priceStyleOverrides: {} });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          title="Unidade e destaque do preço"
        >
          <Tag className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-3 max-h-[80vh] overflow-y-auto"
        align="end"
        side="left"
        sideOffset={8}
      >
        <div className="flex flex-col gap-3">
          {/* Unidade — grava no cadastro (produto) */}
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold">Unidade</p>
            <Select
              value={product.unit}
              onValueChange={(v) =>
                unitMutation.mutate({
                  productId: product.id,
                  unit: v as ProductUnit,
                })
              }
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNIT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="h-px bg-border" />

          {/* Destaque do preço — estilo de exibição (só este ou todos) */}
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold">Destaque do preço</p>
            <div className="flex gap-1">
              {(["plain", "boxed", "highlight"] as const).map((v) => (
                <Button
                  key={v}
                  type="button"
                  size="sm"
                  variant={effStyle.variant === v ? "default" : "outline"}
                  className="flex-1 px-1 text-[11px]"
                  onClick={() => setStyle({ variant: v })}
                >
                  {STYLE_LABELS[v]}
                </Button>
              ))}
            </div>
            {effStyle.variant !== "plain" && (
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  {effStyle.variant === "highlight" ? "Fundo" : "Borda"}
                  <input
                    type="color"
                    value={effStyle.accent}
                    onChange={(e) => setStyle({ accent: e.target.value })}
                    className="h-6 w-6 rounded border p-0"
                  />
                </label>
                <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  Texto
                  <input
                    type="color"
                    value={effStyle.text}
                    onChange={(e) => setStyle({ text: e.target.value })}
                    className="h-6 w-6 rounded border p-0"
                  />
                </label>
              </div>
            )}
            {/* Tamanho do texto do preço */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">
                Tamanho do preço
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() =>
                    setStyle({
                      size: Math.max(
                        0.7,
                        Math.round(((effStyle.size ?? 1) - 0.1) * 10) / 10,
                      ),
                    })
                  }
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-9 text-center text-[11px] tabular-nums">
                  {Math.round((effStyle.size ?? 1) * 100)}%
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() =>
                    setStyle({
                      size: Math.min(
                        2.5,
                        Math.round(((effStyle.size ?? 1) + 0.1) * 10) / 10,
                      ),
                    })
                  }
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Alinhamento dos textos */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">
                Alinhamento
              </span>
              <div className="flex gap-1">
                {(
                  [
                    { v: "left", Icon: AlignLeft },
                    { v: "center", Icon: AlignCenter },
                    { v: "right", Icon: AlignRight },
                  ] as const
                ).map(({ v, Icon }) => (
                  <Button
                    key={v}
                    type="button"
                    variant={
                      (effStyle.align ?? "left") === v ? "default" : "outline"
                    }
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setStyle({ align: v })}
                  >
                    <Icon className="h-3 w-3" />
                  </Button>
                ))}
              </div>
            </div>

            {/* Preço "De" (riscado) — cor + tamanho */}
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                Preço "De"
                <input
                  type="color"
                  value={effStyle.deColor ?? "#000000"}
                  onChange={(e) => setStyle({ deColor: e.target.value })}
                  className="h-6 w-6 rounded border p-0"
                />
              </label>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() =>
                    setStyle({
                      deSize: Math.max(
                        0.7,
                        Math.round(((effStyle.deSize ?? 1) - 0.1) * 10) / 10,
                      ),
                    })
                  }
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-9 text-center text-[11px] tabular-nums">
                  {Math.round((effStyle.deSize ?? 1) * 100)}%
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() =>
                    setStyle({
                      deSize: Math.min(
                        2.5,
                        Math.round(((effStyle.deSize ?? 1) + 0.1) * 10) / 10,
                      ),
                    })
                  }
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* "Economize R$…" — cor + tamanho */}
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                Economize
                <input
                  type="color"
                  value={effStyle.savingsColor ?? "#16a34a"}
                  onChange={(e) => setStyle({ savingsColor: e.target.value })}
                  className="h-6 w-6 rounded border p-0"
                />
              </label>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() =>
                    setStyle({
                      savingsSize: Math.max(
                        0.7,
                        Math.round(((effStyle.savingsSize ?? 1) - 0.1) * 10) /
                          10,
                      ),
                    })
                  }
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-9 text-center text-[11px] tabular-nums">
                  {Math.round((effStyle.savingsSize ?? 1) * 100)}%
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() =>
                    setStyle({
                      savingsSize: Math.min(
                        2.5,
                        Math.round(((effStyle.savingsSize ?? 1) + 0.1) * 10) /
                          10,
                      ),
                    })
                  }
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-[11px]"
              onClick={applyStyleToAll}
            >
              Aplicar este estilo a todos
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface ConfigPanelProps {
  config: CatalogConfig;
  products: CatalogProduct[];
  // Quantos produtos cabem por página do catálogo — usado para desenhar a
  // quebra de página na lista lateral.
  itemsPerPage: number;
  onConfigChange: (changes: Partial<CatalogConfig>) => void;
  // Captura a miniatura (JPEG data URL) da página atual — para salvar o padrão.
  captureThumbnail?: () => Promise<string>;
  // Aba ativa controlada de fora (rail de ícones no editor, estilo Canva). No
  // mobile o TabsList horizontal continua visível.
  activeTab?: string;
  onActiveTabChange?: (value: string) => void;
}

const TEXT_SIZES: Array<{ value: CatalogConfig["textSize"]; label: string }> = [
  { value: "xs", label: "Mínimo (12px)" },
  { value: "sm", label: "Pequeno (16px)" },
  { value: "base", label: "Médio (22px)" },
  { value: "lg", label: "Grande (30px)" },
  { value: "xl", label: "Muito grande (40px)" },
  { value: "2xl", label: "Enorme (52px)" },
  { value: "3xl", label: "Gigante (64px)" },
  { value: "4xl", label: "Máximo (80px)" },
];

const FONT_WEIGHTS: Array<{
  value: CatalogConfig["fontWeight"];
  label: string;
}> = [
  { value: "normal", label: "Normal" },
  { value: "medium", label: "Médio" },
  { value: "semibold", label: "Semi-negrito" },
  { value: "bold", label: "Negrito" },
];

const LAYOUTS: Array<{ value: CatalogConfig["layout"]; label: string }> = [
  { value: "grid-2", label: "2 colunas" },
  { value: "grid-3", label: "3 colunas" },
  { value: "grid-4", label: "4 colunas" },
  { value: "list", label: "Lista" },
  { value: "featured", label: "Destaque" },
  { value: "carousel", label: "Carrossel" },
  { value: "masonry", label: "Masonry" },
  { value: "table", label: "Tabela" },
];

export function ConfigPanel({
  config,
  products,
  itemsPerPage,
  onConfigChange,
  captureThumbnail,
  activeTab = "produtos",
  onActiveTabChange,
}: ConfigPanelProps) {
  const { suppliers } = useSupplier();
  const suppliersWithLogo = suppliers.filter((s) => s.logo);

  // Accordion da aba Layout: só uma seção aberta por vez (abrir fecha as outras).
  const [openSection, setOpenSection] = useState("Identidade");
  const sectionProps = (t: string) => ({
    open: openSection === t,
    onToggle: () => setOpenSection((cur) => (cur === t ? "" : t)),
  });

  // Padrões (presets de estilo).
  const { data: templates = [] } = useCatalogTemplates();
  const createTemplate = useCreateCatalogTemplate();
  const updateTemplate = useUpdateCatalogTemplate();
  const deleteTemplate = useDeleteCatalogTemplate();
  const createCatalog = useCreateCatalog();
  const [templateName, setTemplateName] = useState("");
  // Padrão "atual" (último salvo/aplicado) — alvo do "Atualizar padrão atual".
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(
    null,
  );
  type SavedTemplate = (typeof templates)[number];
  const [confirmApply, setConfirmApply] = useState<SavedTemplate | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SavedTemplate | null>(
    null,
  );
  const currentTemplate = templates.find((t) => t.id === currentTemplateId);

  const handleSaveTemplate = async () => {
    const name = templateName.trim();
    if (!name) return;
    const thumbnail = captureThumbnail ? await captureThumbnail() : "";
    createTemplate.mutate(
      {
        name,
        config: toTemplateConfig(config),
        thumbnail: thumbnail || undefined,
      },
      {
        onSuccess: (data) => {
          setTemplateName("");
          setCurrentTemplateId(data.id);
        },
      },
    );
  };

  // Atualiza o padrão "atual" com a aparência atual do catálogo.
  const handleUpdateTemplate = async () => {
    if (!currentTemplateId) return;
    const thumbnail = captureThumbnail ? await captureThumbnail() : "";
    updateTemplate.mutate({
      id: currentTemplateId,
      config: toTemplateConfig(config),
      thumbnail: thumbnail || undefined,
    });
  };

  const applyTemplate = (t: SavedTemplate) => {
    onConfigChange(t.config as Partial<CatalogConfig>);
    setCurrentTemplateId(t.id);
    setConfirmApply(null);
  };

  // Cria um NOVO catálogo já com a aparência do padrão (e navega até ele).
  const createFromTemplate = (t: SavedTemplate) => {
    createCatalog.mutate({
      name: t.name,
      config: t.config as Record<string, unknown>,
    });
  };

  // Etiquetas (biblioteca de PNGs arrastáveis para o canvas).
  const { data: assets = [] } = useCatalogAssets();
  const createAsset = useCreateCatalogAsset();
  const deleteAsset = useDeleteCatalogAsset();
  const assetInputRef = useRef<HTMLInputElement>(null);

  // Reordena um produto na lista (↑/↓) e persiste a ordem manual na config.
  const moveProduct = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= products.length) return;
    const ids = products.map((p) => p.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    onConfigChange({ productOrder: ids });
  };

  // Padding da imagem por lado + atalho "todos os lados".
  const imgPad = {
    top: config.imagePaddingTop ?? 0,
    right: config.imagePaddingRight ?? 0,
    bottom: config.imagePaddingBottom ?? 0,
    left: config.imagePaddingLeft ?? 0,
  };
  const imgPadAllSame =
    imgPad.top === imgPad.right &&
    imgPad.right === imgPad.bottom &&
    imgPad.bottom === imgPad.left;
  const setImgPadAll = (v: number) =>
    onConfigChange({
      imagePaddingTop: v,
      imagePaddingRight: v,
      imagePaddingBottom: v,
      imagePaddingLeft: v,
    });

  return (
    <Tabs
      value={activeTab}
      onValueChange={onActiveTabChange}
      className="flex flex-col h-full overflow-hidden"
    >
      {/* No desktop as abas viram o rail de ícones do editor (lg:hidden aqui);
          no mobile continuam como abas horizontais. */}
      <TabsList className="w-full rounded-none border-b shrink-0 h-10 bg-transparent justify-start px-2 gap-1 lg:hidden">
        <TabsTrigger value="produtos" className="text-xs h-8">
          Produtos
        </TabsTrigger>
        <TabsTrigger value="layout" className="text-xs h-8">
          Layout
        </TabsTrigger>
        <TabsTrigger value="padroes" className="text-xs h-8">
          Padrões
        </TabsTrigger>
        <TabsTrigger value="etiqueta" className="text-xs h-8">
          Etiqueta
        </TabsTrigger>
      </TabsList>

      {/* ── Layout: Identidade / Layout / Cards / Fundo em seções retráteis ── */}
      <TabsContent value="layout" className="flex-1 overflow-y-auto m-0 p-3">
        <div className="flex flex-col gap-2">
          <CollapsibleSection
            title="Identidade"
            {...sectionProps("Identidade")}
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="catalog-title">Título</Label>
                <Switch
                  checked={config.showTitle !== false}
                  onCheckedChange={(v) => onConfigChange({ showTitle: v })}
                />
              </div>
              <Input
                id="catalog-title"
                value={config.title}
                onChange={(e) => onConfigChange({ title: e.target.value })}
                placeholder="Promoções"
                disabled={config.showTitle === false}
              />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="catalog-subtitle">Subtítulo</Label>
                <Switch
                  checked={config.showSubtitle !== false}
                  onCheckedChange={(v) => onConfigChange({ showSubtitle: v })}
                />
              </div>
              <Input
                id="catalog-subtitle"
                value={config.subtitle}
                onChange={(e) => onConfigChange({ subtitle: e.target.value })}
                placeholder="Válido até..."
                disabled={config.showSubtitle === false}
              />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="catalog-footer">Rodapé</Label>
                <Switch
                  checked={config.showFooter !== false}
                  onCheckedChange={(v) => onConfigChange({ showFooter: v })}
                />
              </div>
              <Input
                id="catalog-footer"
                value={config.footerText}
                onChange={(e) => onConfigChange({ footerText: e.target.value })}
                placeholder="Ex: Consulte condições. Sujeito a estoque."
                disabled={config.showFooter === false}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-between font-normal"
                    disabled={config.showFooter === false}
                  >
                    {TEXT_SIZES.find((s) => s.value === config.footerTextSize)
                      ?.label ?? "Mínimo (12px)"}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48">
                  <DropdownMenuRadioGroup
                    value={config.footerTextSize}
                    onValueChange={(v) =>
                      onConfigChange({
                        footerTextSize: v as CatalogConfig["textSize"],
                      })
                    }
                  >
                    {TEXT_SIZES.map((s) => (
                      <DropdownMenuRadioItem key={s.value} value={s.value}>
                        {s.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {suppliersWithLogo.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" />
                    Logos de fornecedores no rodapé
                  </Label>
                  <Switch
                    checked={config.showFooterSuppliers !== false}
                    onCheckedChange={(v) =>
                      onConfigChange({ showFooterSuppliers: v })
                    }
                  />
                </div>
                <div
                  className={cn(
                    "flex flex-col gap-1.5 max-h-40 overflow-y-auto",
                    config.showFooterSuppliers === false &&
                      "pointer-events-none opacity-50",
                  )}
                >
                  {suppliersWithLogo.map((s) => {
                    const selected = config.footerSupplierIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() =>
                          onConfigChange({
                            footerSupplierIds: selected
                              ? config.footerSupplierIds.filter(
                                  (id) => id !== s.id,
                                )
                              : [...config.footerSupplierIds, s.id],
                          })
                        }
                        className={`flex items-center gap-2 rounded border px-2 py-1.5 text-sm transition-colors ${
                          selected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted/50"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={constructUrl(s.logo!)}
                          alt={s.name}
                          className="h-6 w-6 object-contain rounded"
                        />
                        <span className="truncate flex-1 text-left">
                          {s.tradeName || s.name}
                        </span>
                        {selected && (
                          <X className="h-3 w-3 shrink-0 text-primary" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </CollapsibleSection>

          <CollapsibleSection title="Layout" {...sectionProps("Layout")}>
            <div className="flex flex-col gap-2">
              <Label>Tamanho da página</Label>
              <div className="flex gap-2">
                <Button
                  variant={config.pageSize === "square" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => onConfigChange({ pageSize: "square" })}
                >
                  1:1 Quadrado
                </Button>
                <Button
                  variant={
                    config.pageSize === "portrait" ? "default" : "outline"
                  }
                  size="sm"
                  className="flex-1"
                  onClick={() => onConfigChange({ pageSize: "portrait" })}
                >
                  3:4 Retrato
                </Button>
                <Button
                  variant={config.pageSize === "story" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => onConfigChange({ pageSize: "story" })}
                >
                  Story 9:16
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Disposição</Label>
              <Select
                value={config.layout}
                onValueChange={(v) =>
                  onConfigChange({ layout: v as CatalogConfig["layout"] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LAYOUTS.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Ordenação</Label>
              <Select
                value={config.sortBy}
                onValueChange={(v) =>
                  onConfigChange({ sortBy: v as CatalogConfig["sortBy"] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="discount-desc">
                    Maior desconto %
                  </SelectItem>
                  <SelectItem value="savings-desc">
                    Maior economia R$
                  </SelectItem>
                  <SelectItem value="price-asc">Menor preço</SelectItem>
                  <SelectItem value="price-desc">Maior preço</SelectItem>
                  <SelectItem value="name-asc">Nome A-Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="Estilo do card"
            {...sectionProps("Estilo do card")}
          >
            <div className="flex flex-col gap-2">
              <Label>Estilo do card</Label>
              <div className="grid grid-cols-2 gap-2">
                {CARD_STYLES.map((s) => {
                  const active = config.cardStyle === s.value;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      title={s.hint}
                      onClick={() => onConfigChange({ cardStyle: s.value })}
                      className={cn(
                        "flex flex-col overflow-hidden rounded-md border text-left transition-colors",
                        active
                          ? "border-primary ring-2 ring-primary"
                          : "border-border hover:border-foreground/30",
                      )}
                    >
                      <div className="h-[108px] bg-background p-1">
                        <CardStyleThumb variant={s.value} />
                      </div>
                      <span
                        className={cn(
                          "border-t px-2 py-1 text-xs",
                          active
                            ? "font-medium text-primary"
                            : "text-muted-foreground",
                        )}
                      >
                        {s.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <ColorPickerField
              label="Cor do card"
              value={config.cardColor}
              onChange={(hex) => onConfigChange({ cardColor: hex })}
            />
            <div className="flex items-center justify-between">
              <Label htmlFor="hide-price-border">
                Sem contorno do box de preço
              </Label>
              <Switch
                id="hide-price-border"
                checked={config.hidePriceBorder === true}
                onCheckedChange={(v) => onConfigChange({ hidePriceBorder: v })}
              />
            </div>

            <SubGroupLabel>Exibir nos cards</SubGroupLabel>
            {(
              [
                { key: "showDescription", label: "Descrição" },
                { key: "showCategory", label: "Categoria" },
                { key: "showStock", label: "Estoque" },
                { key: "showSku", label: "SKU" },
                { key: "showUnit", label: "Unidade (kg/un/cx…)" },
              ] as const
            ).map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <Label htmlFor={key}>{label}</Label>
                <Switch
                  id={key}
                  checked={config[key]}
                  onCheckedChange={(v) => onConfigChange({ [key]: v })}
                />
              </div>
            ))}

            <SubGroupLabel>Imagem</SubGroupLabel>
            <div className="flex items-center justify-between">
              <Label htmlFor="hide-image-border">Sem contorno da imagem</Label>
              <Switch
                id="hide-image-border"
                checked={config.hideImageBorder === true}
                onCheckedChange={(v) => onConfigChange({ hideImageBorder: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="hide-image-shadow">Sem sombra da imagem</Label>
              <Switch
                id="hide-image-shadow"
                checked={config.hideImageShadow === true}
                onCheckedChange={(v) => onConfigChange({ hideImageShadow: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="hide-image-bg">Fundo transparente</Label>
              <Switch
                id="hide-image-bg"
                checked={config.hideImageBackground === true}
                onCheckedChange={(v) =>
                  onConfigChange({ hideImageBackground: v })
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="image-margin" className="text-xs">
                Margem (px)
              </Label>
              <Input
                id="image-margin"
                type="number"
                min={0}
                max={100}
                value={config.imageMargin ?? 0}
                onChange={(e) =>
                  onConfigChange({ imageMargin: Number(e.target.value) })
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-xs">Padding da imagem</Label>
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="image-pad-all"
                  className="text-[11px] text-muted-foreground"
                >
                  Pixel em todos os lados
                </Label>
                <Input
                  id="image-pad-all"
                  type="number"
                  min={0}
                  max={100}
                  placeholder={imgPadAllSame ? undefined : "—"}
                  value={imgPadAllSame ? imgPad.top : ""}
                  onChange={(e) => setImgPadAll(Number(e.target.value))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="image-pad-top" className="text-[11px]">
                    Cima
                  </Label>
                  <Input
                    id="image-pad-top"
                    type="number"
                    min={0}
                    max={100}
                    value={imgPad.top}
                    onChange={(e) =>
                      onConfigChange({
                        imagePaddingTop: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="image-pad-right" className="text-[11px]">
                    Direita
                  </Label>
                  <Input
                    id="image-pad-right"
                    type="number"
                    min={0}
                    max={100}
                    value={imgPad.right}
                    onChange={(e) =>
                      onConfigChange({
                        imagePaddingRight: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="image-pad-bottom" className="text-[11px]">
                    Baixo
                  </Label>
                  <Input
                    id="image-pad-bottom"
                    type="number"
                    min={0}
                    max={100}
                    value={imgPad.bottom}
                    onChange={(e) =>
                      onConfigChange({
                        imagePaddingBottom: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="image-pad-left" className="text-[11px]">
                    Esquerda
                  </Label>
                  <Input
                    id="image-pad-left"
                    type="number"
                    min={0}
                    max={100}
                    value={imgPad.left}
                    onChange={(e) =>
                      onConfigChange({
                        imagePaddingLeft: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
            </div>

            <SubGroupLabel>Tipografia</SubGroupLabel>
            <div className="flex flex-col gap-2">
              <Label className="flex items-center gap-1.5">
                <CaseSensitive className="h-3.5 w-3.5" />
                Tamanho do texto
              </Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between font-normal"
                  >
                    {TEXT_SIZES.find((s) => s.value === config.textSize)
                      ?.label ?? "Pequeno"}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48">
                  <DropdownMenuRadioGroup
                    value={config.textSize}
                    onValueChange={(v) =>
                      onConfigChange({
                        textSize: v as CatalogConfig["textSize"],
                      })
                    }
                  >
                    {TEXT_SIZES.map((s) => (
                      <DropdownMenuRadioItem key={s.value} value={s.value}>
                        {s.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex flex-col gap-2">
              <Label className="flex items-center gap-1.5">
                <Bold className="h-3.5 w-3.5" />
                Peso da fonte
              </Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between font-normal"
                  >
                    {FONT_WEIGHTS.find((w) => w.value === config.fontWeight)
                      ?.label ?? "Médio"}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48">
                  <DropdownMenuRadioGroup
                    value={config.fontWeight}
                    onValueChange={(v) =>
                      onConfigChange({
                        fontWeight: v as CatalogConfig["fontWeight"],
                      })
                    }
                  >
                    {FONT_WEIGHTS.map((w) => (
                      <DropdownMenuRadioItem key={w.value} value={w.value}>
                        {w.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="Fundo (cor e imagem)"
            {...sectionProps("Fundo (cor e imagem)")}
          >
            <ColorPickerField
              label="Cor de fundo"
              value={config.backgroundColor}
              onChange={(hex) => onConfigChange({ backgroundColor: hex })}
            />
            <div className="flex flex-col gap-2">
              <Label>Imagem de fundo</Label>
              <BackgroundImageUploader
                value={config.backgroundImage}
                onChange={(key) => onConfigChange({ backgroundImage: key })}
              />
              {config.backgroundImage && (
                <div className="flex gap-2">
                  <Button
                    variant={
                      config.backgroundFit === "cover" ? "default" : "outline"
                    }
                    size="sm"
                    className="flex-1"
                    onClick={() => onConfigChange({ backgroundFit: "cover" })}
                  >
                    Cobrir tudo
                  </Button>
                  <Button
                    variant={
                      config.backgroundFit === "contain" ? "default" : "outline"
                    }
                    size="sm"
                    className="flex-1"
                    onClick={() => onConfigChange({ backgroundFit: "contain" })}
                  >
                    Caber inteiro
                  </Button>
                </div>
              )}
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="Espaçamento interno (px)"
            {...sectionProps("Espaçamento interno (px)")}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pad-top" className="text-xs">
                  Cima
                </Label>
                <Input
                  id="pad-top"
                  type="number"
                  min={0}
                  max={200}
                  value={config.paddingTop}
                  onChange={(e) =>
                    onConfigChange({ paddingTop: Number(e.target.value) })
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pad-bottom" className="text-xs">
                  Baixo
                </Label>
                <Input
                  id="pad-bottom"
                  type="number"
                  min={0}
                  max={200}
                  value={config.paddingBottom}
                  onChange={(e) =>
                    onConfigChange({ paddingBottom: Number(e.target.value) })
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pad-left" className="text-xs">
                  Esquerda
                </Label>
                <Input
                  id="pad-left"
                  type="number"
                  min={0}
                  max={200}
                  value={config.paddingLeft}
                  onChange={(e) =>
                    onConfigChange({ paddingLeft: Number(e.target.value) })
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pad-right" className="text-xs">
                  Direita
                </Label>
                <Input
                  id="pad-right"
                  type="number"
                  min={0}
                  max={200}
                  value={config.paddingRight}
                  onChange={(e) =>
                    onConfigChange({ paddingRight: Number(e.target.value) })
                  }
                />
              </div>
            </div>
          </CollapsibleSection>
        </div>
      </TabsContent>

      {/* ── Produtos ── */}
      <TabsContent value="produtos" className="flex-1 overflow-y-auto m-0 p-4">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Produtos ({products.length})
          </p>
          <AddProductDialog config={config} onConfigChange={onConfigChange} />
          <div className="flex flex-col gap-1 max-h-[calc(100vh-160px)] overflow-y-auto">
            {products.map((p, index) => (
              <Fragment key={p.id}>
                {/* Quebra de página: divisor onde começa cada página do catálogo */}
                {itemsPerPage > 0 &&
                  index > 0 &&
                  index % itemsPerPage === 0 && (
                    <div className="flex items-center gap-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <div className="h-px flex-1 bg-border" />
                      Página {Math.floor(index / itemsPerPage) + 1}
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  )}
                <div className="flex gap-2 py-1.5 px-2 rounded hover:bg-muted">
                  <ProductPhotoButton
                    product={p}
                    config={config}
                    onConfigChange={onConfigChange}
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate flex-1 text-sm">{p.name}</span>
                      {/* Reordenar (↑/↓) — define a ordem manual dos produtos */}
                      <div className="flex shrink-0 flex-col">
                        <button
                          type="button"
                          className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                          title="Mover para cima"
                          disabled={index === 0}
                          onClick={() => moveProduct(index, -1)}
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                          title="Mover para baixo"
                          disabled={index === products.length - 1}
                          onClick={() => moveProduct(index, 1)}
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        title="Remover do catálogo"
                        onClick={() =>
                          onConfigChange({
                            excludedProductIds: [
                              ...config.excludedProductIds,
                              p.id,
                            ],
                            // Também sai de manuallyAddedIds: senão vira
                            // "fantasma" (some da lista mas o diálogo de
                            // adicionar ainda o mostra como "Adicionado").
                            manuallyAddedIds: config.manuallyAddedIds.filter(
                              (id) => id !== p.id,
                            ),
                          })
                        }
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <ProductInlinePrices
                        product={p}
                        config={config}
                        onConfigChange={onConfigChange}
                      />
                      <ProductStylePopover
                        product={p}
                        config={config}
                        onConfigChange={onConfigChange}
                      />
                    </div>
                  </div>
                </div>
              </Fragment>
            ))}
          </div>
        </div>
      </TabsContent>

      {/* ── Padrões: salvar/aplicar presets de estilo (com miniatura) ── */}
      <TabsContent value="padroes" className="flex-1 overflow-y-auto m-0 p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Salvar padrão
            </p>
            <Input
              placeholder="Título do padrão"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveTemplate()}
            />
            <Button
              size="sm"
              className="w-full gap-1"
              disabled={!templateName.trim() || createTemplate.isPending}
              onClick={handleSaveTemplate}
            >
              {createTemplate.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Salvar padrão atual
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-1"
              disabled={!currentTemplateId || updateTemplate.isPending}
              title={
                currentTemplate
                  ? `Atualiza "${currentTemplate.name}" com a aparência atual`
                  : "Salve ou aplique um padrão para poder atualizá-lo"
              }
              onClick={handleUpdateTemplate}
            >
              {updateTemplate.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Atualizar padrão atual
              {currentTemplate ? ` (${currentTemplate.name})` : ""}
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Salva a aparência (layout, cores, fontes, imagem, estilos…) — sem
              os produtos. Aplicar troca só o visual do catálogo.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Padrões salvos ({templates.length})
            </p>
            {templates.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Nenhum padrão salvo ainda.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {templates.map((t) => (
                  <div
                    key={t.id}
                    className={cn(
                      "group relative flex flex-col overflow-hidden rounded-md border",
                      currentTemplateId === t.id && "ring-2 ring-primary",
                    )}
                  >
                    <button
                      type="button"
                      className="flex flex-col text-left transition-opacity hover:opacity-90"
                      title="Aplicar este padrão"
                      onClick={() => setConfirmApply(t)}
                    >
                      <div className="aspect-square w-full bg-muted">
                        {t.thumbnail ? (
                          // biome-ignore lint/performance/noImgElement: miniatura em data URL
                          <img
                            src={t.thumbnail}
                            alt={t.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                            sem prévia
                          </div>
                        )}
                      </div>
                      <span className="truncate px-2 py-1.5 text-xs">
                        {t.name}
                      </span>
                    </button>
                    {/* Criar a partir deste padrão — aparece ao passar o mouse. */}
                    <Button
                      size="sm"
                      variant="secondary"
                      className="absolute inset-x-1 top-1/3 h-7 gap-1 text-[11px] opacity-0 shadow transition-opacity group-hover:opacity-100"
                      title="Criar um novo catálogo com este padrão"
                      disabled={createCatalog.isPending}
                      onClick={() => createFromTemplate(t)}
                    >
                      <CopyPlus className="h-3 w-3" />
                      Criar a partir deste
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1 h-6 w-6 bg-background/80 opacity-0 transition-opacity group-hover:opacity-100"
                      title="Excluir padrão"
                      disabled={deleteTemplate.isPending}
                      onClick={() => setConfirmDelete(t)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Confirmação: substituir o padrão atual pelo escolhido */}
        <Dialog
          open={!!confirmApply}
          onOpenChange={(o) => !o && setConfirmApply(null)}
        >
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Substituir o padrão atual?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Você deseja substituir o padrão atual por{" "}
              <span className="font-medium text-foreground">
                “{confirmApply?.name}”
              </span>
              ? Só a aparência do catálogo muda — os produtos permanecem.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmApply(null)}>
                Cancelar
              </Button>
              <Button
                onClick={() => confirmApply && applyTemplate(confirmApply)}
              >
                Substituir
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Confirmação: excluir padrão */}
        <Dialog
          open={!!confirmDelete}
          onOpenChange={(o) => !o && setConfirmDelete(null)}
        >
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Excluir padrão?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Excluir o padrão{" "}
              <span className="font-medium text-foreground">
                “{confirmDelete?.name}”
              </span>
              ? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmDelete(null)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={deleteTemplate.isPending}
                onClick={() => {
                  if (confirmDelete) {
                    deleteTemplate.mutate({ id: confirmDelete.id });
                    if (currentTemplateId === confirmDelete.id)
                      setCurrentTemplateId(null);
                    setConfirmDelete(null);
                  }
                }}
              >
                Excluir
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </TabsContent>

      {/* ── Etiqueta: biblioteca de PNGs para arrastar sobre o catálogo ── */}
      <TabsContent value="etiqueta" className="flex-1 overflow-y-auto m-0 p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Adicionar etiqueta
            </p>
            <input
              ref={assetInputRef}
              type="file"
              accept="image/png,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) createAsset.upload(file);
                e.target.value = "";
              }}
            />
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-1"
              disabled={createAsset.isPending}
              onClick={() => assetInputRef.current?.click()}
            >
              {createAsset.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              Enviar PNG
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Logos, selos e figuras (de preferência PNG com fundo
              transparente). Arraste da biblioteca para cima do catálogo.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Biblioteca ({assets.length})
            </p>
            {assets.length === 0 ? (
              <div className="flex flex-col items-center gap-1 py-6 text-center text-sm text-muted-foreground">
                <Sticker className="h-6 w-6 opacity-50" />
                Nenhuma etiqueta ainda.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {assets.map((a) => (
                  <div
                    key={a.id}
                    className="group relative aspect-square overflow-hidden rounded-md border bg-[repeating-conic-gradient(#e5e7eb_0_25%,#fff_0_50%)] bg-[length:16px_16px]"
                    title={`${a.name} — arraste para o catálogo`}
                  >
                    {/* biome-ignore lint/performance/noImgElement: etiqueta arrastável */}
                    <img
                      src={constructUrl(a.key)}
                      alt={a.name}
                      draggable
                      onDragStart={(e) =>
                        e.dataTransfer.setData("text/plain", a.key)
                      }
                      className="h-full w-full cursor-grab object-contain p-1 active:cursor-grabbing"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0.5 top-0.5 h-5 w-5 bg-background/80 opacity-0 transition-opacity group-hover:opacity-100"
                      title="Excluir etiqueta"
                      disabled={deleteAsset.isPending}
                      onClick={() => deleteAsset.mutate({ id: a.id })}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
