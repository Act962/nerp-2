"use client";

import { useState } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, X, CaseSensitive, Bold, Tag, Building2 } from "lucide-react";
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
import { formatPrice } from "./cards/price-badge";
import { useUpdateProductPrice } from "../hooks/use-catalog";
import { useSupplier } from "@/features/supplier/hooks/use-supplier";
import { constructUrl } from "@/hooks/use-construct-url";
import type { CatalogConfig, CatalogProduct } from "../types";

function ProductPricePopover({ product }: { product: CatalogProduct }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string>(
    product.promotionalPrice != null ? String(product.promotionalPrice) : "",
  );
  const mutation = useUpdateProductPrice();

  const handleSave = () => {
    const price = value !== "" ? Number(value) : null;
    mutation.mutate(
      { productId: product.id, promotionalPrice: price },
      { onSuccess: () => setOpen(false) },
    );
  };

  const handleClear = () => {
    mutation.mutate(
      { productId: product.id, promotionalPrice: null },
      { onSuccess: () => { setValue(""); setOpen(false); } },
    );
  };

  const discount = value !== "" && Number(value) < product.salePrice
    ? Math.round(((product.salePrice - Number(value)) / product.salePrice) * 100)
    : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-1 text-xs hover:opacity-80 transition-opacity"
          title="Editar preço promocional"
        >
          {product.promotionalPrice != null ? (
            <span className="text-green-600 font-medium flex items-center gap-0.5">
              <Tag className="h-3 w-3" />
              {formatPrice(product.promotionalPrice)}
            </span>
          ) : (
            <span className="text-muted-foreground flex items-center gap-0.5">
              <Tag className="h-3 w-3" />
              Definir promo
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="end" side="left" sideOffset={8}>
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold">Preço promocional</p>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">
              Venda normal: {formatPrice(product.salePrice)}
            </Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground shrink-0">R$</span>
              <Input
                type="number"
                min={0}
                step={0.01}
                className="h-8 text-sm"
                placeholder="0,00"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                autoFocus
              />
              {discount != null && (
                <span className="text-xs text-green-600 font-medium shrink-0">
                  -{discount}%
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={mutation.isPending}
              onClick={handleClear}
            >
              Limpar
            </Button>
            <Button
              size="sm"
              className="flex-1"
              disabled={mutation.isPending || value === ""}
              onClick={handleSave}
            >
              {mutation.isPending ? "Salvando..." : "Salvar"}
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
  onConfigChange: (changes: Partial<CatalogConfig>) => void;
}

const TEXT_SIZES: Array<{ value: CatalogConfig["textSize"]; label: string }> = [
  { value: "xs",   label: "Mínimo (12px)" },
  { value: "sm",   label: "Pequeno (16px)" },
  { value: "base", label: "Médio (22px)" },
  { value: "lg",   label: "Grande (30px)" },
  { value: "xl",   label: "Muito grande (40px)" },
  { value: "2xl",  label: "Enorme (52px)" },
  { value: "3xl",  label: "Gigante (64px)" },
  { value: "4xl",  label: "Máximo (80px)" },
];

const FONT_WEIGHTS: Array<{ value: CatalogConfig["fontWeight"]; label: string }> = [
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

export function ConfigPanel({ config, products, onConfigChange }: ConfigPanelProps) {
  const { suppliers } = useSupplier();
  const suppliersWithLogo = suppliers.filter((s) => s.logo);

  return (
    <Tabs defaultValue="geral" className="flex flex-col h-full overflow-hidden">
      <TabsList className="w-full rounded-none border-b shrink-0 h-10 bg-transparent justify-start px-2 gap-1">
        <TabsTrigger value="geral" className="text-xs h-8">Geral</TabsTrigger>
        <TabsTrigger value="card" className="text-xs h-8">Card</TabsTrigger>
        <TabsTrigger value="fundo" className="text-xs h-8">Fundo</TabsTrigger>
      </TabsList>

      {/* ── Geral ── */}
      <TabsContent value="geral" className="flex-1 overflow-y-auto m-0 p-4">
        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Identidade
            </p>
            <div className="flex flex-col gap-2">
              <Label htmlFor="catalog-title">Título</Label>
              <Input
                id="catalog-title"
                value={config.title}
                onChange={(e) => onConfigChange({ title: e.target.value })}
                placeholder="Promoções"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="catalog-subtitle">Subtítulo</Label>
              <Input
                id="catalog-subtitle"
                value={config.subtitle}
                onChange={(e) => onConfigChange({ subtitle: e.target.value })}
                placeholder="Válido até..."
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="catalog-footer">Rodapé</Label>
              <Input
                id="catalog-footer"
                value={config.footerText}
                onChange={(e) => onConfigChange({ footerText: e.target.value })}
                placeholder="Ex: Consulte condições. Sujeito a estoque."
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-between font-normal">
                    {TEXT_SIZES.find((s) => s.value === config.footerTextSize)?.label ?? "Mínimo (12px)"}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48">
                  <DropdownMenuRadioGroup
                    value={config.footerTextSize}
                    onValueChange={(v) =>
                      onConfigChange({ footerTextSize: v as CatalogConfig["textSize"] })
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
                <Label className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  Logos de fornecedores no rodapé
                </Label>
                <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                  {suppliersWithLogo.map((s) => {
                    const selected = config.footerSupplierIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() =>
                          onConfigChange({
                            footerSupplierIds: selected
                              ? config.footerSupplierIds.filter((id) => id !== s.id)
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
                        <span className="truncate flex-1 text-left">{s.tradeName || s.name}</span>
                        {selected && <X className="h-3 w-3 shrink-0 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Layout
            </p>
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
                onValueChange={(v) => onConfigChange({ layout: v as CatalogConfig["layout"] })}
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
                onValueChange={(v) => onConfigChange({ sortBy: v as CatalogConfig["sortBy"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="discount-desc">Maior desconto %</SelectItem>
                  <SelectItem value="savings-desc">Maior economia R$</SelectItem>
                  <SelectItem value="price-asc">Menor preço</SelectItem>
                  <SelectItem value="price-desc">Maior preço</SelectItem>
                  <SelectItem value="name-asc">Nome A-Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Exibir nos cards
            </p>
            {(
              [
                { key: "showDescription", label: "Descrição" },
                { key: "showCategory", label: "Categoria" },
                { key: "showStock", label: "Estoque" },
                { key: "showSku", label: "SKU" },
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
          </section>

          <section className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Produtos ({products.length})
            </p>
            <AddProductDialog config={config} onConfigChange={onConfigChange} />
            <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col gap-1 py-1.5 px-2 rounded hover:bg-muted"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate flex-1 text-sm">{p.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      title="Remover do catálogo"
                      onClick={() =>
                        onConfigChange({
                          excludedProductIds: [...config.excludedProductIds, p.id],
                        })
                      }
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground line-through">
                      {formatPrice(p.salePrice)}
                    </span>
                    <ProductPricePopover product={p} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </TabsContent>

      {/* ── Card ── */}
      <TabsContent value="card" className="flex-1 overflow-y-auto m-0 p-4">
        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Estilo
            </p>
            <div className="flex flex-col gap-2">
              <Label>Estilo do card</Label>
              <Select
                value={config.cardStyle}
                onValueChange={(v) =>
                  onConfigChange({ cardStyle: v as CatalogConfig["cardStyle"] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="compact">Compacto</SelectItem>
                  <SelectItem value="standard">Padrão</SelectItem>
                  <SelectItem value="list">Lista</SelectItem>
                  <SelectItem value="minimal">Minimalista</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ColorPickerField
              label="Cor do card"
              value={config.cardColor}
              onChange={(hex) => onConfigChange({ cardColor: hex })}
            />
          </section>

          <section className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tipografia
            </p>
            <div className="flex flex-col gap-2">
              <Label className="flex items-center gap-1.5">
                <CaseSensitive className="h-3.5 w-3.5" />
                Tamanho do texto
              </Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between font-normal">
                    {TEXT_SIZES.find((s) => s.value === config.textSize)?.label ?? "Pequeno"}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48">
                  <DropdownMenuRadioGroup
                    value={config.textSize}
                    onValueChange={(v) =>
                      onConfigChange({ textSize: v as CatalogConfig["textSize"] })
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
                  <Button variant="outline" className="w-full justify-between font-normal">
                    {FONT_WEIGHTS.find((w) => w.value === config.fontWeight)?.label ?? "Médio"}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48">
                  <DropdownMenuRadioGroup
                    value={config.fontWeight}
                    onValueChange={(v) =>
                      onConfigChange({ fontWeight: v as CatalogConfig["fontWeight"] })
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
          </section>
        </div>
      </TabsContent>

      {/* ── Fundo ── */}
      <TabsContent value="fundo" className="flex-1 overflow-y-auto m-0 p-4">
        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Cor e imagem
            </p>
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
                    variant={config.backgroundFit === "cover" ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => onConfigChange({ backgroundFit: "cover" })}
                  >
                    Cobrir tudo
                  </Button>
                  <Button
                    variant={config.backgroundFit === "contain" ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => onConfigChange({ backgroundFit: "contain" })}
                  >
                    Caber inteiro
                  </Button>
                </div>
              )}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Espaçamento interno (px)
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pad-top" className="text-xs">Cima</Label>
                <Input
                  id="pad-top"
                  type="number"
                  min={0}
                  max={200}
                  value={config.paddingTop}
                  onChange={(e) => onConfigChange({ paddingTop: Number(e.target.value) })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pad-bottom" className="text-xs">Baixo</Label>
                <Input
                  id="pad-bottom"
                  type="number"
                  min={0}
                  max={200}
                  value={config.paddingBottom}
                  onChange={(e) => onConfigChange({ paddingBottom: Number(e.target.value) })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pad-left" className="text-xs">Esquerda</Label>
                <Input
                  id="pad-left"
                  type="number"
                  min={0}
                  max={200}
                  value={config.paddingLeft}
                  onChange={(e) => onConfigChange({ paddingLeft: Number(e.target.value) })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pad-right" className="text-xs">Direita</Label>
                <Input
                  id="pad-right"
                  type="number"
                  min={0}
                  max={200}
                  value={config.paddingRight}
                  onChange={(e) => onConfigChange({ paddingRight: Number(e.target.value) })}
                />
              </div>
            </div>
          </section>
        </div>
      </TabsContent>
    </Tabs>
  );
}
