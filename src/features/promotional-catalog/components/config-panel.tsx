"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { uploadToR2 } from "@/lib/upload-to-r2";
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
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  LayoutGrid,
  X,
  Pencil,
  Image as ImageIcon,
  Loader2,
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
  Layers,
  ArrowDownUp,
} from "lucide-react";
import { AddProductDialog } from "./add-product-dialog";
import { BackgroundProperties } from "./background-properties";
import {
  useCatalogAssets,
  useCatalogTemplates,
  useCreateCatalogAsset,
  useCreateCatalogTemplate,
  useUpdateCatalogTemplate,
  usePriceStyles,
  useCreatePriceStyle,
  useUpdatePriceStyle,
  useDeletePriceStyle,
  useDeleteCatalogAsset,
  useRemoveProductBackground,
  useSearchProductImages,
  useSetProductThumbnail,
  useSetProductThumbnailFromUrl,
  useSetProductUnit,
} from "../hooks/use-catalog";
import { imageStyleFromAdjust } from "./cards/image-style";
import { CardFreeLayout } from "./cards/card-free-layout";
import { CardFreeEditor } from "./card-free-editor";
import { SystemTemplatesPanel } from "./system-templates-panel";
import { DynamicPageSection } from "./dynamic-page-section";
import { ImageResizer } from "./image-resizer";
import {
  type DynamicContext,
  resolveEntityImageKey,
} from "../lib/resolve-entity";
import { cardPreviewBg, productCropRect } from "../lib/background-presets";
import { renderCard } from "./catalog-preview";
import { TextProperties } from "./text-properties";
import { constructUrl } from "@/hooks/use-construct-url";
import type { ProductUnit } from "@/generated/prisma/enums";
import {
  type CardLayoutElement,
  type CatalogConfig,
  type CatalogProduct,
  cardShowsSinglePrice,
  DEFAULT_IMAGE_ADJUSTMENT,
  effectiveCardLayout,
  ENTITY_IMAGE_VARS,
  type EntityImageVar,
  type EntitySource,
  entityVarLabel,
  type ImageAdjustment,
  isOfferExpired,
  type LayerSelection,
  makeDynamicOverlay,
  type Overlay,
  type StyleBlock,
  toTemplateConfig,
} from "../types";
import { ElementProperties } from "./element-properties";

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

// Editor do produto (popup ao clicar no card): prévia do card ao vivo + foto
// interativa (menu no hover + nós de redimensionar/cortar) + preços + cores.
// Produto de exemplo para as miniaturas dos estilos salvos.
const SAMPLE_PRODUCT: CatalogProduct = {
  id: "sample",
  name: "Produto Exemplo",
  sku: "0001",
  thumbnail: "",
  salePrice: 7.99,
  unit: "UN",
  basePrice: 9.99,
  promotionalPrice: 5.49,
  discount: 45,
  savings: 4.5,
  categoryName: "Mercearia",
  currentStock: 10,
  description: null,
};

// Grava um preço De/Por no lugar CERTO, mantendo LISTA e PÁGINA em sincronia:
// - produto da LISTA (aba "Lista") → grava no próprio item (normalPrice/
//   offerPrice) e limpa qualquer override, para a lista e a página lerem a mesma
//   fonte;
// - produto do CADASTRO → override por-catálogo (priceOverrides = "De";
//   offerOverrides = "Por"), sem tocar no cadastro/ERP.
function applyProductPrice(
  config: CatalogConfig,
  onConfigChange: (changes: Partial<CatalogConfig>) => void,
  productId: string,
  which: "normal" | "offer",
  value: number | null,
) {
  const v = value != null && value > 0 ? value : undefined;
  const items = config.list?.items;
  const idx = items ? items.findIndex((it) => it.id === productId) : -1;
  if (items && idx >= 0 && config.list) {
    const field = which === "normal" ? "normalPrice" : "offerPrice";
    const nextItems = items.map((it, i) =>
      i === idx ? { ...it, [field]: v } : it,
    );
    const priceO = { ...(config.priceOverrides ?? {}) };
    const offerO = { ...(config.offerOverrides ?? {}) };
    delete priceO[productId];
    delete offerO[productId];
    onConfigChange({
      list: { ...config.list, items: nextItems },
      priceOverrides: priceO,
      offerOverrides: offerO,
    });
    return;
  }
  const key = which === "normal" ? "priceOverrides" : "offerOverrides";
  const next = { ...(config[key] ?? {}) };
  if (v != null) next[productId] = v;
  else delete next[productId];
  onConfigChange({ [key]: next });
}

// O estilo salvo guarda `{ cardLayout: CardLayoutElement[] }`.
function styleToLayout(style: unknown): CardLayoutElement[] {
  const layout = (style as { cardLayout?: CardLayoutElement[] })?.cardLayout;
  return Array.isArray(layout) ? layout : [];
}

// Miniatura de um estilo (etiqueta montada com o produto exemplo, 1:1). Fundo
// CINZA para as etiquetas com áreas claras/transparentes ficarem visíveis.
function PriceStyleThumb({ style }: { style: unknown }) {
  return (
    <div className="aspect-square w-full overflow-hidden rounded-md bg-muted shadow-sm ring-1 ring-border">
      <CardFreeLayout
        product={SAMPLE_PRODUCT}
        elements={styleToLayout(style)}
      />
    </div>
  );
}

// Biblioteca de estilos (aba "Estilos"): "Meus estilos" (da org) e "Estilos do
// sistema" (globais). Clicar aplica o card a todos os produtos.
function PriceStylesLibrary({
  onApply,
  onAdd,
}: {
  onApply: (layout: CardLayoutElement[]) => void;
  onAdd: (layout: CardLayoutElement[]) => void;
}) {
  const { data, isLoading } = usePriceStyles();
  const deleteStyle = useDeletePriceStyle();
  const updateStyle = useUpdatePriceStyle();
  const canManageSystem = data?.canManageSystem ?? false;
  // Estilo em pré-visualização (popup ao clicar numa miniatura).
  const [preview, setPreview] = useState<{
    name: string;
    layout: CardLayoutElement[];
  } | null>(null);
  // Estilo em edição (abre o editor livre com o desenho carregado).
  const [edit, setEdit] = useState<{
    id: string;
    name: string;
    layout: CardLayoutElement[];
  } | null>(null);

  const Grid = ({
    items,
    canManage,
    emptyLabel,
  }: {
    items: { id: string; name: string; style: unknown }[];
    canManage: boolean;
    emptyLabel: string;
  }) =>
    items.length === 0 ? (
      <p className="py-3 text-center text-xs text-muted-foreground">
        {emptyLabel}
      </p>
    ) : (
      <div className="grid grid-cols-2 gap-2">
        {items.map((s) => (
          <div
            key={s.id}
            className="group relative flex flex-col overflow-hidden rounded-md border"
          >
            <button
              type="button"
              className="flex flex-col text-left transition-opacity hover:opacity-90"
              title="Pré-visualizar e aplicar"
              onClick={() =>
                setPreview({ name: s.name, layout: styleToLayout(s.style) })
              }
            >
              <PriceStyleThumb style={s.style} />
              <span className="truncate border-t px-2 py-1 text-xs">
                {s.name}
              </span>
            </button>
            {canManage && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-1 top-1 h-6 w-6 bg-background/80 opacity-0 transition-opacity group-hover:opacity-100"
                  title="Editar estilo"
                  onClick={() =>
                    setEdit({
                      id: s.id,
                      name: s.name,
                      layout: styleToLayout(s.style),
                    })
                  }
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-6 w-6 bg-background/80 opacity-0 transition-opacity group-hover:opacity-100"
                  title="Excluir estilo"
                  disabled={deleteStyle.isPending}
                  onClick={() => deleteStyle.mutate({ id: s.id })}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        ))}
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[11px] text-muted-foreground">
        Etiquetas montadas no editor e salvas aparecem aqui. Clique numa
        miniatura para pré-visualizar e escolher aplicar ou adicionar.
      </p>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Meus estilos {data ? `(${data.mine.length})` : ""}
        </p>
        {isLoading ? (
          <p className="py-3 text-center text-xs text-muted-foreground">
            Carregando…
          </p>
        ) : (
          <Grid
            items={data?.mine ?? []}
            canManage
            emptyLabel="Nenhum estilo salvo ainda."
          />
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Estilos do sistema {data ? `(${data.system.length})` : ""}
        </p>
        <Grid
          items={data?.system ?? []}
          canManage={canManageSystem}
          emptyLabel="Nenhum estilo do sistema."
        />
        {!canManageSystem && (
          <p className="text-[11px] text-muted-foreground">
            Estilos do sistema são criados pelo super usuário.
          </p>
        )}
      </div>

      {/* Popup: pré-visualização do estilo + aplicar/adicionar */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogTitle className="text-base">
            {preview?.name ?? "Estilo"}
          </DialogTitle>
          <div className="mx-auto aspect-square w-full max-w-[300px] overflow-hidden rounded-lg border bg-muted shadow-sm">
            {preview && (
              <CardFreeLayout
                product={SAMPLE_PRODUCT}
                elements={preview.layout}
              />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              onClick={() => {
                if (preview) onApply(preview.layout);
                setPreview(null);
              }}
            >
              Alterar todos os estilos da página
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (preview) onAdd(preview.layout);
                setPreview(null);
              }}
            >
              Adicionar estilo à página
            </Button>
            <p className="text-[11px] text-muted-foreground">
              “Alterar” substitui a Etiqueta de todos os produtos da página.
              “Adicionar” coloca este estilo como um bloco posicionável na
              página (mova/redimensione como uma etiqueta).
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Popup: editar estilo (editor livre + salvar por cima) */}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[1100px]">
          <DialogTitle className="sr-only">Editar estilo</DialogTitle>
          {edit && (
            <div className="flex h-[86vh] flex-col">
              <div className="min-h-0 flex-1 p-3">
                <CardFreeEditor
                  elements={edit.layout}
                  onElementsChange={(els) =>
                    setEdit((s) => (s ? { ...s, layout: els } : s))
                  }
                  product={SAMPLE_PRODUCT}
                  canManageSystem={canManageSystem}
                  hideSave
                  onClose={() => setEdit(null)}
                />
              </div>
              <div className="flex items-center justify-between gap-2 border-t p-3">
                <span className="truncate text-sm font-medium">
                  {edit.name}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setEdit(null)}>
                    Cancelar
                  </Button>
                  <Button
                    disabled={updateStyle.isPending}
                    onClick={() => {
                      updateStyle.mutate({
                        id: edit.id,
                        style: { cardLayout: edit.layout },
                      });
                      setEdit(null);
                    }}
                  >
                    Salvar alterações
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ProductPhotoButton({
  product,
  config,
  onConfigChange,
  onSaveCardLayout,
  open: openProp,
  onOpenChange,
  productIndex,
  pageProductCount,
  entry = "photo",
  initialElementId,
  onPhotoClick,
}: {
  product: CatalogProduct;
  config: CatalogConfig;
  onConfigChange: (changes: Partial<CatalogConfig>) => void;
  onSaveCardLayout?: (
    scope: "product" | "page" | "all",
    layout: CardLayoutElement[],
    productId: string,
  ) => void;
  // Modo controlado (Fase 5): abrir o popup da foto ao clicar no card no canvas.
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  // Posição do produto na página (índice na fatia + total) — para o preview
  // mostrar o recorte do fundo na célula real do produto.
  productIndex?: number;
  pageProductCount?: number;
  // Como o popup foi aberto, define o que ele mostra:
  // - "label": abre direto no Editor livre ("Montar Etiqueta");
  // - "photo" (padrão): abre a gestão de foto ("Editar produto").
  // (O antigo modo "completo" com "Prévia da Etiqueta" foi removido.)
  entry?: "photo" | "label";
  // Elemento pré-selecionado no Editor livre (duplo-clique numa variável).
  initialElementId?: string;
  // Clique no thumbnail da foto (aba Produtos): delega ao pai a abertura como
  // "photo" — se ausente, cai no comportamento antigo (abrir o próprio popup).
  onPhotoClick?: () => void;
}) {
  const [openState, setOpenState] = useState(false);
  // Retângulo EXATO do card na página (frações do fundo) — recorta o fundo dos
  // previews na posição/tamanho reais do card. A caixa da "Prévia" recebe a
  // proporção da célula (`previewCrop.aspect`) p/ o recorte não distorcer.
  const previewCrop = productCropRect(
    config,
    productIndex ?? -1,
    pageProductCount ?? 0,
  );
  const previewBg = cardPreviewBg(config, previewCrop);
  const [extUploading, setExtUploading] = useState(false);
  // Este produto é uma LINHA da aba "Lista"? (id da linha, não do cadastro).
  const listIndex =
    config.list?.items?.findIndex((it) => it.id === product.id) ?? -1;
  const listItem = listIndex >= 0 ? config.list?.items?.[listIndex] : undefined;
  // Alvo das operações de foto (upload / web / remover fundo):
  // - linha da Lista CASADA com um produto → o produto do cadastro (foto
  //   reaproveitada em todo lugar);
  // - linha da Lista SEM produto → null (foto vive só na linha);
  // - produto normal do cadastro → ele mesmo.
  const realProductId = listItem?.productId;
  const rowOnly = listIndex >= 0 && !realProductId;
  const photoProductId = rowOnly ? null : (realProductId ?? product.id);
  // Espelha a chave da foto na Lista. Quando a linha está casada com um produto
  // do cadastro, replica para TODAS as linhas do mesmo produto (todas as páginas
  // de clientes), não só a que está sendo editada.
  const syncRowThumb = (key: string) => {
    const list = config.list;
    if (listIndex < 0 || !list) return;
    onConfigChange({
      list: {
        ...list,
        items: list.items.map((it) =>
          it.id === product.id ||
          (realProductId && it.productId === realProductId)
            ? { ...it, thumbnail: key }
            : it,
        ),
      },
    });
  };
  // Linha SEM produto do cadastro: a foto fica só na linha (via R2).
  const uploadRowThumbnail = async (file: File) => {
    setExtUploading(true);
    try {
      syncRowThumb(await uploadToR2(file));
      toast.success("Foto atualizada");
    } catch {
      toast.error("Falha ao enviar a imagem");
    } finally {
      setExtUploading(false);
    }
  };
  const open = openProp ?? openState;
  const setOpen = onOpenChange ?? setOpenState;
  // Rascunho do "Montar card" (sem auto-save): edições ficam locais até o
  // usuário escolher um escopo de salvamento. Inicia do card efetivo do produto.
  const effectiveCardLayout =
    config.cardLayoutOverrides?.[product.id] ?? config.cardLayout ?? [];
  const [cardDraft, setCardDraft] =
    useState<CardLayoutElement[]>(effectiveCardLayout);
  const savedCardRef = useRef<string>(JSON.stringify(effectiveCardLayout));
  const cardDirty = JSON.stringify(cardDraft) !== savedCardRef.current;
  // Confirmação ao sair do "Montar card" com alterações não salvas. "editor" =
  // voltar à edição do produto; "modal" = fechar o modal inteiro.
  const [confirmLeave, setConfirmLeave] = useState<"editor" | "modal" | null>(
    null,
  );
  const saveCardScope = (scope: "product" | "page" | "all") => {
    onSaveCardLayout?.(scope, cardDraft, product.id);
    savedCardRef.current = JSON.stringify(cardDraft);
    setOpen(false);
  };
  const discardCard = () => {
    setCardDraft(effectiveCardLayout);
    savedCardRef.current = JSON.stringify(effectiveCardLayout);
  };
  // Voltar do "Montar Etiqueta": fecha o popup (o guard de alterações não salvas
  // fica no onOpenChange do Dialog).
  const handleCardClose = () => setOpen(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, isPending: uploading } = useSetProductThumbnail();
  // Biblioteca de estilos de preço (salvar padrão + saber se é super usuário).
  const createPriceStyle = useCreatePriceStyle();
  const { data: priceStyles } = usePriceStyles();
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

  const applyUrl = (url: string) => {
    if (!photoProductId) return;
    fromUrl.mutate(
      { productId: photoProductId, url },
      {
        onSuccess: (data) => {
          syncRowThumb(data.thumbnail);
          setOpen(false);
        },
      },
    );
  };

  const visible = results.filter((u) => !broken.has(u));

  // Preços (De/Por), ambos por-catálogo — De = priceOverrides; Por (oferta) =
  // offerOverrides. Não alteram o cadastro/ERP.
  const basePrice = product.basePrice ?? product.salePrice;
  // Etiqueta de UM preço só (sem "De" riscado) → o preço é a OFERTA ("Por").
  // `effectiveCardLayout` (const local acima) já é a etiqueta efetiva do produto.
  const priceHasTwo =
    product.promotionalPrice != null &&
    product.promotionalPrice < product.salePrice;
  const singlePrice = cardShowsSinglePrice(effectiveCardLayout, priceHasTwo);
  const [de, setDe] = useState<string>(
    singlePrice
      ? String(config.priceOverrides?.[product.id] ?? "")
      : String(config.priceOverrides?.[product.id] ?? basePrice),
  );
  const [por, setPor] = useState<string>(
    product.promotionalPrice != null
      ? String(product.promotionalPrice)
      : singlePrice
        ? String(product.salePrice)
        : "",
  );
  const applyDe = () => {
    const num = de !== "" ? Number(de) : Number.NaN;
    applyProductPrice(
      config,
      onConfigChange,
      product.id,
      "normal",
      Number.isFinite(num) && num > 0 && num !== basePrice ? num : null,
    );
  };
  const applyPor = () => {
    const num = por !== "" ? Number(por) : Number.NaN;
    applyProductPrice(
      config,
      onConfigChange,
      product.id,
      "offer",
      Number.isFinite(num) && num > 0 ? num : null,
    );
  };

  // Unidade (kg/un/cx…) — grava no cadastro do produto.
  const unitMutation = useSetProductUnit();

  const [showPos, setShowPos] = useState(false);
  // Texto do input de busca (header). A busca em si é pelo nome/EAN do produto.
  const [searchQuery, setSearchQuery] = useState("");
  // Coluna direita: edição do produto ↔ construtor "Padrão de estilos de preços".
  const [mode, setMode] = useState<"product" | "priceStyle">("product");
  // O modo "product" agora é SEMPRE a gestão de foto ("Editar produto"): o
  // antigo popup com "Prévia da Etiqueta" + "Preços" foi removido.
  const photoOnly = true;
  // Ao ABRIR, escolhe a tela conforme a origem do clique: lápis → Editor livre;
  // foto/duplo-clique → editar produto. Só na transição fechado→aberto, para não
  // sobrescrever a navegação interna (voltar do editor livre p/ o produto).
  const prevOpenRef = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: effectiveCardLayout muda a cada render; o guard `!prevOpenRef` garante que só sacode na transição de abertura.
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      if (entry === "label") {
        // Semeia o rascunho do card a partir do layout efetivo (igual ao lápis
        // interno) e abre direto no Editor livre.
        setCardDraft(effectiveCardLayout);
        savedCardRef.current = JSON.stringify(effectiveCardLayout);
        setMode("priceStyle");
      } else {
        setMode("product");
      }
    }
    prevOpenRef.current = open;
  }, [open, entry]);

  // Nó de redimensionar (canto): arrastar p/ cima = zoom in; p/ baixo = zoom out.
  const scaleDrag = useRef<{ sy: number; base: number } | null>(null);
  const onScalePointerMove = (e: PointerEvent) => {
    const d = scaleDrag.current;
    if (!d) return;
    const delta = (d.sy - e.clientY) / 120;
    setAdjust({
      scale: Math.min(3, Math.max(0.5, Math.round((d.base + delta) * 10) / 10)),
    });
  };
  const onScalePointerUp = () => {
    scaleDrag.current = null;
    window.removeEventListener("pointermove", onScalePointerMove);
    window.removeEventListener("pointerup", onScalePointerUp);
  };
  const startScaleDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    scaleDrag.current = { sy: e.clientY, base: adjust.scale };
    window.addEventListener("pointermove", onScalePointerMove);
    window.addEventListener("pointerup", onScalePointerUp);
  };

  return (
    <>
      {/* Thumbnail alto (topo do nome à base do "De/Por"): mostra a foto atual
          do produto; clicar segue o fluxo normal (enviar / buscar na web). */}
      <button
        type="button"
        className="relative aspect-square w-16 shrink-0 self-start overflow-hidden rounded border bg-muted flex items-center justify-center transition-opacity hover:opacity-80"
        title="Foto do produto (enviar ou buscar na web)"
        disabled={uploading}
        onClick={() => (onPhotoClick ? onPhotoClick() : setOpen(true))}
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : product.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={constructUrl(product.thumbnail)}
            alt={product.name}
            className="h-full w-full object-contain p-1"
          />
        ) : (
          <ImageIcon className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          // Fechar o modal no "Montar card" com alterações → confirma antes.
          if (!o && mode === "priceStyle" && cardDirty) {
            setConfirmLeave("modal");
            return;
          }
          setOpen(o);
        }}
      >
        <DialogContent
          className={cn(
            "gap-0 overflow-hidden p-0",
            mode === "priceStyle" ? "sm:max-w-[1100px]" : "sm:max-w-[920px]",
          )}
        >
          {/* Título acessível sempre presente (Radix exige um DialogTitle). */}
          <DialogTitle className="sr-only">
            {mode === "priceStyle"
              ? "Editor de Etiqueta"
              : `Editar produto — ${product.name}`}
          </DialogTitle>
          {mode === "priceStyle" ? (
            <div className="flex h-[86vh] flex-col">
              <div className="min-h-0 flex-1">
                <CardFreeEditor
                  elements={cardDraft}
                  onElementsChange={setCardDraft}
                  product={product}
                  cardAspectRatio={config.cardAspectRatio}
                  onCardAspectChange={(ratio) =>
                    onConfigChange({ cardAspectRatio: ratio })
                  }
                  pageCrop={previewCrop}
                  pageBgConfig={config}
                  pageBackground={previewBg}
                  hideCardBackground={config.hideCardBackground}
                  cardColor={config.cardColor}
                  onCardBgChange={(changes) => onConfigChange(changes)}
                  canManageSystem={priceStyles?.canManageSystem ?? false}
                  onSaveStyle={(name, scope) => {
                    createPriceStyle.mutate({
                      name,
                      style: { cardLayout: cardDraft },
                      scope,
                    });
                  }}
                  onClose={handleCardClose}
                  initialSelectedId={initialElementId}
                  onEditPhoto={() => setMode("product")}
                  onSetPrice={(which, value) =>
                    applyProductPrice(
                      config,
                      onConfigChange,
                      product.id,
                      which,
                      value,
                    )
                  }
                />
              </div>
              {/* Salvar com escopo (sem auto-save) */}
              <div className="flex flex-wrap items-center justify-end gap-2 border-t bg-background p-3">
                <span className="mr-auto text-[11px] text-muted-foreground">
                  {cardDirty
                    ? "Alterações não salvas"
                    : "Nenhuma alteração pendente"}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!cardDirty}
                  onClick={() => saveCardScope("product")}
                >
                  Salvar só para esse produto
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!cardDirty}
                  onClick={() => saveCardScope("page")}
                >
                  Alterar só essa página
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!cardDirty}
                  onClick={() => saveCardScope("all")}
                >
                  Alterar todas as páginas
                </Button>
              </div>
            </div>
          ) : (
            <div
              className={cn(
                "grid max-h-[92vh] grid-cols-1 overflow-y-auto",
                !photoOnly && "md:grid-cols-[250px_1fr]",
              )}
            >
              {/* Coluna esquerda — prévia do card + Alinhamento. Escondida no
                  modo "foto" (clique no thumbnail): só gestão de imagem. */}
              {!photoOnly && (
                <div className="relative flex flex-col items-center gap-3 border-b bg-muted/40 p-6 md:border-b-0 md:border-r">
                  {/* Abre o editor de card livre (largura cheia) */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-2 h-7 w-7"
                    title="Editar Etiqueta (editor livre)"
                    onClick={() => {
                      setCardDraft(effectiveCardLayout);
                      savedCardRef.current =
                        JSON.stringify(effectiveCardLayout);
                      setMode("priceStyle");
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Prévia da Etiqueta
                  </p>
                  {/* Card sobre o recorte EXATO do fundo. A caixa tem a proporção
                    da célula (largura fixa → altura da célula), então o card
                    ocupa a caixa e a etiqueta de preço aparece inteira. */}
                  <div
                    className={cn(
                      "w-[205px] overflow-hidden rounded-xl shadow-sm [&>*]:h-full",
                      !previewBg && "bg-muted/30",
                    )}
                    style={{
                      ...(previewBg ?? {}),
                      aspectRatio: previewCrop
                        ? String(previewCrop.aspect)
                        : undefined,
                    }}
                  >
                    {renderCard(product, config, {})}
                  </div>
                  <p className="max-w-[205px] text-center text-[11px] text-muted-foreground">
                    Desenhe a Etiqueta (variáveis, formas, preço) no editor
                    livre — ícone de lápis acima.
                  </p>
                </div>
              )}

              {/* Coluna direita — Editar produto */}
              <div className="flex min-w-0 flex-col gap-4 p-5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-ml-1 mr-auto h-8 gap-1 text-xs"
                  onClick={() => setOpen(false)}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Voltar
                </Button>
                {/* Header: busca de foto na web (só quando há produto do banco). */}
                {!rowOnly && (
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && runSearch()}
                      placeholder="Buscar foto do produto na web e pressione Enter…"
                      className="h-10 pr-9 pl-9"
                      aria-label="Buscar foto na web"
                    />
                    {search.isPending && (
                      <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                    )}
                  </div>
                )}

                <h3 className="truncate pr-8 text-base font-semibold">
                  Editar produto — {product.name}
                </h3>

                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    if (photoProductId) {
                      // Salva no produto do cadastro e sincroniza a linha (se houver).
                      setExtUploading(true);
                      try {
                        const key = await upload(photoProductId, file);
                        if (key) syncRowThumb(key);
                      } finally {
                        setExtUploading(false);
                      }
                    } else {
                      await uploadRowThumbnail(file);
                    }
                  }}
                />

                {/* Ações da foto */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">Foto</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    disabled={uploading || extUploading}
                    onClick={() => inputRef.current?.click()}
                  >
                    {uploading || extUploading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    Enviar do computador
                  </Button>
                  {!rowOnly && product.thumbnail && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 text-xs"
                      disabled={removeBg.isPending}
                      onClick={() => {
                        if (!photoProductId) return;
                        removeBg.mutate(
                          { productId: photoProductId },
                          { onSuccess: (data) => syncRowThumb(data.thumbnail) },
                        );
                      }}
                    >
                      {removeBg.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Wand2 className="h-3.5 w-3.5" />
                      )}
                      Remover fundo
                    </Button>
                  )}
                  {isAdjusted && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="ml-auto h-8 gap-1 text-xs"
                      onClick={resetAdjust}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Restaurar
                    </Button>
                  )}
                </div>

                {/* Foto + enquadramento */}
                <div className="flex flex-col gap-3">
                  <div className="group relative mx-auto aspect-square w-full max-w-[260px] overflow-hidden rounded-lg border bg-muted">
                    {product.thumbnail ? (
                      // biome-ignore lint/performance/noImgElement: preview local do ajuste
                      <img
                        src={constructUrl(product.thumbnail)}
                        alt={product.name}
                        className="absolute inset-0 h-full w-full"
                        style={imageStyleFromAdjust(adjust)}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                        Sem foto
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-3 rounded-sm border border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.04)]" />
                    {[
                      "left-2 top-2",
                      "right-2 top-2",
                      "left-2 bottom-2",
                      "right-2 bottom-2",
                    ].map((pos) => (
                      <button
                        key={pos}
                        type="button"
                        title="Arraste para redimensionar (zoom)"
                        onPointerDown={startScaleDrag}
                        className={cn(
                          "absolute h-3.5 w-3.5 rounded-sm border-2 border-primary bg-background shadow",
                          pos,
                        )}
                        style={{ cursor: "nwse-resize" }}
                      />
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-1 rounded-md border p-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant={adjust.fit === "contain" ? "default" : "outline"}
                      className="h-7 px-2 text-[11px]"
                      onClick={() => setAdjust({ fit: "contain" })}
                    >
                      Caber
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={adjust.fit === "cover" ? "default" : "outline"}
                      className="h-7 px-2 text-[11px]"
                      onClick={() => setAdjust({ fit: "cover" })}
                    >
                      Cobrir
                    </Button>
                    <span className="mx-1 h-4 w-px bg-border" />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      title="Diminuir zoom"
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
                      className="h-7 w-7"
                      title="Aumentar zoom"
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
                    <span className="mx-1 h-4 w-px bg-border" />
                    <Button
                      type="button"
                      size="sm"
                      variant={showPos ? "default" : "outline"}
                      className="h-7 px-2 text-[11px]"
                      onClick={() => setShowPos((s) => !s)}
                    >
                      Posições
                    </Button>
                  </div>

                  {showPos && (
                    <div className="flex flex-col gap-2 rounded-md border p-3">
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
                  )}

                  {visible.length > 0 && (
                    <div className="grid max-h-36 grid-cols-4 gap-2 overflow-y-auto rounded-md border p-2">
                      {visible.map((url) => (
                        <button
                          key={url}
                          type="button"
                          disabled={fromUrl.isPending}
                          onClick={() => applyUrl(url)}
                          className="relative aspect-square overflow-hidden rounded border bg-muted disabled:opacity-50"
                          title="Usar esta imagem"
                        >
                          {/* biome-ignore lint/performance/noImgElement: URL externa arbitrária */}
                          <img
                            src={url}
                            alt=""
                            className="size-full object-contain"
                            onError={() =>
                              setBroken((prev) => new Set(prev).add(url))
                            }
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Preços + Unidade na mesma linha (inputs maiores). Escondido
                    no modo "foto" (clique no thumbnail). */}
                {!photoOnly && (
                  <div className="flex flex-col gap-2">
                    <h3 className="text-sm font-semibold">Preços</h3>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-[11px] text-muted-foreground">
                          {singlePrice
                            ? "De (normal, opcional)"
                            : "De (normal)"}
                        </span>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          className="h-11 text-lg font-semibold"
                          placeholder={singlePrice ? "normal" : undefined}
                          value={de}
                          onChange={(e) => setDe(e.target.value)}
                          onBlur={applyDe}
                          onKeyDown={(e) => e.key === "Enter" && applyDe()}
                          aria-label="Preço De (R$)"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[11px] text-muted-foreground">
                          {singlePrice ? "Por (oferta)" : "Por (promo)"}
                        </span>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          className="h-11 text-lg font-semibold"
                          placeholder={singlePrice ? "oferta" : "promo"}
                          value={por}
                          onChange={(e) => setPor(e.target.value)}
                          onBlur={applyPor}
                          onKeyDown={(e) => e.key === "Enter" && applyPor()}
                          aria-label="Preço Por (R$)"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[11px] text-muted-foreground">
                          Unidade
                        </span>
                        <Select
                          value={product.unit}
                          onValueChange={(v) =>
                            unitMutation.mutate({
                              productId: product.id,
                              unit: v as ProductUnit,
                            })
                          }
                        >
                          <SelectTrigger className="h-11 text-base">
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
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmação ao sair do "Montar card" com alterações não salvas. */}
      <Dialog
        open={confirmLeave !== null}
        onOpenChange={(o) => !o && setConfirmLeave(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogTitle className="text-base">Sair sem salvar?</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Você tem alterações na Etiqueta que ainda não foram salvas. Se sair
            agora, elas serão descartadas.
          </p>
          <div className="mt-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmLeave(null)}
            >
              Continuar editando
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                const target = confirmLeave;
                discardCard();
                setMode("product");
                setConfirmLeave(null);
                if (target === "modal") setOpen(false);
              }}
            >
              Sair sem salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Edição rápida De/Por direto na lista. Ambos por-catálogo (não tocam o
// cadastro): De = priceOverrides (normal); Por = offerOverrides (oferta). Numa
// etiqueta de preço único, o preço aparece em "Por".
function ProductInlinePrices({
  product,
  config,
  onConfigChange,
}: {
  product: CatalogProduct;
  config: CatalogConfig;
  onConfigChange: (changes: Partial<CatalogConfig>) => void;
}) {
  const basePrice = product.basePrice ?? product.salePrice;
  const override = config.priceOverrides?.[product.id];
  // Etiqueta de UM preço só (sem "De" riscado) → o preço é a OFERTA ("Por").
  const layout = effectiveCardLayout(config, product.id);
  const hasTwoPrices =
    product.promotionalPrice != null &&
    product.promotionalPrice < product.salePrice;
  const singlePrice = cardShowsSinglePrice(layout, hasTwoPrices);

  // No modo preço-único, "Por" recebe o preço do produto (default) e "De" é o
  // normal opcional. `product.promotionalPrice` já reflete o offerOverride.
  const [de, setDe] = useState<string>(
    singlePrice ? String(override ?? "") : String(override ?? basePrice),
  );
  const [por, setPor] = useState<string>(
    product.promotionalPrice != null
      ? String(product.promotionalPrice)
      : singlePrice
        ? String(product.salePrice)
        : "",
  );

  // De/Por gravam na fonte certa (item da lista OU override do catálogo), então
  // lista e página ficam sempre em sincronia.
  const applyDe = () => {
    const num = de !== "" ? Number(de) : Number.NaN;
    applyProductPrice(
      config,
      onConfigChange,
      product.id,
      "normal",
      Number.isFinite(num) && num > 0 && num !== basePrice ? num : null,
    );
  };
  const applyPor = () => {
    const num = por !== "" ? Number(por) : Number.NaN;
    applyProductPrice(
      config,
      onConfigChange,
      product.id,
      "offer",
      Number.isFinite(num) && num > 0 ? num : null,
    );
  };

  return (
    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className="flex min-w-0 flex-1 items-center gap-1">
        De
        <Input
          type="number"
          min={0}
          step={0.01}
          className="h-7 min-w-0 flex-1 px-1.5 text-xs"
          placeholder={singlePrice ? "normal" : undefined}
          value={de}
          onChange={(e) => setDe(e.target.value)}
          onBlur={applyDe}
          onKeyDown={(e) => e.key === "Enter" && applyDe()}
        />
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-1">
        Por
        <Input
          type="number"
          min={0}
          step={0.01}
          className="h-7 min-w-0 flex-1 px-1.5 text-xs"
          placeholder={singlePrice ? "oferta" : "promo"}
          value={por}
          onChange={(e) => setPor(e.target.value)}
          onBlur={applyPor}
          onKeyDown={(e) => e.key === "Enter" && applyPor()}
        />
      </span>
    </div>
  );
}

interface ConfigPanelProps {
  config: CatalogConfig;
  // Lista COMPLETA de produtos do catálogo (todas as páginas) — usada para a
  // ordem global e para resolver o produto de um bloco de estilo.
  products: CatalogProduct[];
  // Produtos da PÁGINA ATUAL (a fatia efetiva do preview). A aba "Produtos"
  // lista só estes — os que realmente estão na página, sem repetição.
  pageProducts: CatalogProduct[];
  onConfigChange: (changes: Partial<CatalogConfig>) => void;
  // Captura a miniatura (JPEG data URL) da página atual — para salvar o padrão.
  captureThumbnail?: () => Promise<string>;
  // Aba ativa controlada de fora (rail de ícones no editor, estilo Canva). No
  // mobile o TabsList horizontal continua visível.
  activeTab?: string;
  onActiveTabChange?: (value: string) => void;
  // Seleção de camada no canvas — quando é um Elemento, a aba Etiqueta mostra
  // suas propriedades (Fase 4).
  selection?: LayerSelection;
  // Altera a seleção (Fase 5): abrir/fechar o popup da foto ao clicar no card
  // sincroniza com a seleção do canvas.
  onSelectionChange?: (selection: LayerSelection) => void;
  // Pedido para abrir "Editar produto" de fora (duplo clique no card da página).
  // O `nonce` reabre mesmo o mesmo produto.
  editProductRequest?: {
    id: string;
    nonce: number;
    entry?: "photo" | "label";
    elementId?: string;
  } | null;
  // Sinal (contador) para abrir o diálogo "Adicionar produto" de fora — ex.: o
  // botão do estado de página vazia. Cada incremento abre o diálogo.
  addProductSignal?: number;
  // Salvar o card livre ("Montar card") com escopo escolhido pelo usuário.
  onSaveCardLayout?: (
    scope: "product" | "page" | "all",
    layout: CardLayoutElement[],
    productId: string,
  ) => void;
  // Aplica a aparência (fundo) da página atual a TODAS as páginas.
  onApplyStyleToAllPages?: () => void;
  // Quantidade de páginas (habilita o botão "aplicar a todas").
  pageCount?: number;
  // Nome da página atual (para casar a loja da "Página dinâmica" pelo nome).
  pageName?: string;
  // "Todas as páginas dinâmicas": estado + ação (aplica/remove em todas).
  allPagesDynamic?: boolean;
  onAllPagesDynamic?: (dynamic: CatalogConfig["dynamic"]) => void;
  // Entidades resolvidas da página atual — para pré-visualizar a imagem da
  // etiqueta dinâmica no redimensionador.
  dynamicContext?: DynamicContext;
}

// Ordenação dos produtos na página (movida do cabeçalho da página p/ a aba
// Produtos, ao lado do título).
// Enquadramento "neutro" da etiqueta (imagem): "Caber" (contain) — logos cabem
// inteiras sem cortar. Difere do produto, cujo default é "Cobrir".
const OVERLAY_ADJUST_BASELINE: ImageAdjustment = {
  scale: 1,
  posX: 50,
  posY: 50,
  fit: "contain",
};

const SORT_OPTS: { value: CatalogConfig["sortBy"]; label: string }[] = [
  { value: "discount-desc", label: "Maior desconto" },
  { value: "savings-desc", label: "Maior economia" },
  { value: "price-asc", label: "Menor preço" },
  { value: "price-desc", label: "Maior preço" },
  { value: "name-asc", label: "Nome A-Z" },
];

export function ConfigPanel({
  config,
  products,
  pageProducts,
  onConfigChange,
  captureThumbnail,
  activeTab = "produtos",
  onActiveTabChange,
  selection,
  onSelectionChange,
  editProductRequest,
  addProductSignal,
  onSaveCardLayout,
  onApplyStyleToAllPages,
  pageCount = 1,
  pageName = "",
  allPagesDynamic,
  onAllPagesDynamic,
  dynamicContext,
}: ConfigPanelProps) {
  // Produto cujo modal de edição está aberto (abre pelo lápis "editar").
  const [editingId, setEditingId] = useState<string | null>(null);
  // Como o popup foi aberto (define o que ele mostra): lápis/duplo-clique no card
  // → "Montar Etiqueta" (label); foto → "Editar produto" (photo).
  const [editEntry, setEditEntry] = useState<"photo" | "label">("photo");
  // Elemento pré-selecionado no Editor livre (duplo-clique numa variável).
  const [editElementId, setEditElementId] = useState<string | undefined>();
  // Abre o popup quando o canvas pede (duplo clique no card). Cada pedido é um
  // objeto novo (nonce), então reabre mesmo o mesmo produto.
  useEffect(() => {
    if (editProductRequest?.id) {
      setEditEntry(editProductRequest.entry ?? "label");
      setEditElementId(editProductRequest.elementId);
      setEditingId(editProductRequest.id);
    }
  }, [editProductRequest]);
  // Diálogo "Adicionar produto" (aba Produtos) — controlado, para o botão do
  // estado de página vazia poder abri-lo via `addProductSignal`.
  const [addProductOpen, setAddProductOpen] = useState(false);
  useEffect(() => {
    if (addProductSignal && addProductSignal > 0) setAddProductOpen(true);
  }, [addProductSignal]);

  // Seleção múltipla de produtos (checkbox + Shift+clique = range) para agrupar.
  const [selectedForGroup, setSelectedForGroup] = useState<Set<string>>(
    new Set(),
  );
  const lastPickedIndex = useRef<number | null>(null);
  const toggleProductSelect = (
    index: number,
    id: string,
    shiftKey: boolean,
  ) => {
    setSelectedForGroup((prev) => {
      const next = new Set(prev);
      if (shiftKey && lastPickedIndex.current != null) {
        // Range do último clicado até este (inclusive) → seleciona todos.
        const [a, b] = [lastPickedIndex.current, index].sort((x, y) => x - y);
        for (let i = a; i <= b; i++) {
          const pid = pageProducts[i]?.id;
          if (pid) next.add(pid);
        }
      } else if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    lastPickedIndex.current = index;
  };

  // Grupos NOMEADOS de produtos da página (config.productGroups com productIds).
  const namedGroups = (config.productGroups ?? []).filter(
    (g) => g.productIds !== undefined,
  );
  const [groupsCollapsed, setGroupsCollapsed] = useState(false);
  // Grupo selecionado → a lista de produtos da "Página" mostra só os dele.
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const updateGroup = (
    groupId: string,
    patch: Partial<{
      bgColor: string;
      bgOpacity: number;
      radius: number;
      borderColor: string;
      borderWidth: number;
      gridCols: number;
      gridRows: number;
    }>,
  ) =>
    onConfigChange({
      productGroups: (config.productGroups ?? []).map((g) =>
        g.id === groupId ? { ...g, ...patch } : g,
      ),
    });
  // Adiciona um produto a um grupo específico (a partir do "Adicionar em qual
  // grupo?"). Se já estava noutro grupo, migra.
  const addProductToGroup = (productId: string, groupId: string) =>
    onConfigChange({
      productGroups: (config.productGroups ?? []).map((g) =>
        g.productIds
          ? {
              ...g,
              productIds:
                g.id === groupId
                  ? [...new Set([...g.productIds, productId])]
                  : g.productIds.filter((id) => id !== productId),
            }
          : g,
      ),
    });
  const removeProductFromGroups = (productId: string) =>
    onConfigChange({
      productGroups: (config.productGroups ?? []).map((g) =>
        g.productIds
          ? { ...g, productIds: g.productIds.filter((id) => id !== productId) }
          : g,
      ),
    });
  const addGroupFromSelection = () => {
    const ids = pageProducts
      .map((p) => p.id)
      .filter((id) => selectedForGroup.has(id));
    if (ids.length === 0) return;
    const existing = config.productGroups ?? [];
    const rows = Math.max(1, Math.ceil(ids.length / 3));
    // Região empilhada abaixo das existentes (px no canvas 1080×pageH).
    const top = 120 + existing.length * 380;
    const group = {
      id: crypto.randomUUID(),
      name: `Grupo ${namedGroups.length + 1}`,
      productIds: ids,
      rect: { x: 40, y: top, w: 1000, h: rows * 300 },
      gridCols: 3,
      gridRows: rows,
    };
    onConfigChange({ productGroups: [...existing, group] });
    setSelectedForGroup(new Set());
    lastPickedIndex.current = null;
  };
  const renameGroup = (groupId: string, name: string) =>
    onConfigChange({
      productGroups: (config.productGroups ?? []).map((g) =>
        g.id === groupId ? { ...g, name } : g,
      ),
    });
  const removeGroup = (groupId: string) =>
    onConfigChange({
      productGroups: (config.productGroups ?? []).filter(
        (g) => g.id !== groupId,
      ),
    });

  // Ao selecionar um produto no canvas, rola a lista lateral até ele (o contorno
  // já vem do `ring` na linha).
  const selectedRowRef = useRef<HTMLDivElement>(null);
  const selectedCardId = selection?.kind === "card" ? selection.id : null;
  useEffect(() => {
    if (selectedCardId) {
      selectedRowRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedCardId]);

  // Elemento (etiqueta) selecionado no canvas → propriedades na aba Etiqueta.
  const overlays = config.overlays ?? [];
  const selectedOverlayIndex =
    selection?.kind === "element"
      ? overlays.findIndex((o) => o.id === selection.id)
      : -1;
  const selectedOverlay =
    selectedOverlayIndex >= 0 ? overlays[selectedOverlayIndex] : null;

  const updateOverlay = (patch: Partial<Overlay>) => {
    if (!selectedOverlay) return;
    onConfigChange({
      overlays: overlays.map((o) =>
        o.id === selectedOverlay.id ? { ...o, ...patch } : o,
      ),
    });
  };
  // Src da imagem da etiqueta selecionada (resolve o binding dinâmico; senão o
  // asset) — para o redimensionador pré-visualizar.
  const selectedOverlaySrc = (() => {
    if (!selectedOverlay) return "";
    const key = selectedOverlay.binding
      ? resolveEntityImageKey(selectedOverlay.binding, dynamicContext ?? {})
      : null;
    const k = key ?? selectedOverlay.assetKey;
    return !k ? "" : k.startsWith("http") ? k : constructUrl(k);
  })();
  const setOverlayAdjust = (patch: Partial<ImageAdjustment>) =>
    updateOverlay({
      adjust: {
        ...OVERLAY_ADJUST_BASELINE,
        ...(selectedOverlay?.adjust ?? {}),
        ...patch,
      },
    });
  // z-order: mais tarde no array = pintado na frente.
  const reorderOverlay = (dir: 1 | -1) => {
    const from = selectedOverlayIndex;
    const to = from + dir;
    if (from < 0 || to < 0 || to >= overlays.length) return;
    const next = [...overlays];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onConfigChange({ overlays: next });
  };
  const deleteOverlay = () => {
    if (!selectedOverlay) return;
    onConfigChange({
      overlays: overlays.filter((o) => o.id !== selectedOverlay.id),
    });
  };

  // Padrões (presets de estilo). O bloco "Salvar como padrão" fica na aba
  // Layout; escolher um padrão para iniciar um catálogo agora vive em
  // "+ Novo catálogo".
  const { data: templatesData } = useCatalogTemplates();
  const templates = templatesData?.mine ?? [];
  const createTemplate = useCreateCatalogTemplate();
  const updateTemplate = useUpdateCatalogTemplate();
  const [templateName, setTemplateName] = useState("");
  // Padrão "atual" (último salvo nesta sessão) — alvo do "Atualizar padrão".
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(
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

  // Etiquetas (biblioteca de PNGs arrastáveis para o canvas).
  const { data: assets = [] } = useCatalogAssets();
  const createAsset = useCreateCatalogAsset();
  const deleteAsset = useDeleteCatalogAsset();
  const assetInputRef = useRef<HTMLInputElement>(null);

  // Reordena um produto na lista (↑/↓) e persiste a ordem manual na config.
  // Reordena dentro da PÁGINA (índices locais). Como a fatia da página é
  // contígua na ordem global, mapeamos para os índices globais e trocamos lá.
  const moveProduct = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= pageProducts.length) return;
    const aId = pageProducts[index].id;
    const bId = pageProducts[target].id;
    // Catálogo de LISTA: a ordem vive em `list.items` (fonte única) — reordenar
    // aqui reflete na aba Lista ao vivo, e vice-versa.
    const items = config.list?.items;
    if (items) {
      const ai = items.findIndex((it) => it.id === aId);
      const bi = items.findIndex((it) => it.id === bId);
      if (ai >= 0 && bi >= 0 && config.list) {
        const next = [...items];
        [next[ai], next[bi]] = [next[bi], next[ai]];
        onConfigChange({ list: { ...config.list, items: next } });
        return;
      }
    }
    // Cadastro: ordem manual em `productOrder`.
    const ids = products.map((p) => p.id);
    const gi = ids.indexOf(aId);
    const gt = ids.indexOf(bId);
    if (gi < 0 || gt < 0) return;
    [ids[gi], ids[gt]] = [ids[gt], ids[gi]];
    onConfigChange({ productOrder: ids });
  };

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
          Página
        </TabsTrigger>
        <TabsTrigger value="lista" className="text-xs h-8">
          Lista
        </TabsTrigger>
        <TabsTrigger value="layout" className="text-xs h-8">
          Layout
        </TabsTrigger>
        <TabsTrigger value="fundo" className="text-xs h-8">
          Fundo
        </TabsTrigger>
        <TabsTrigger value="texto" className="text-xs h-8">
          Texto
        </TabsTrigger>
        <TabsTrigger value="etiqueta" className="text-xs h-8">
          Figurinhas
        </TabsTrigger>
        <TabsTrigger value="estilos" className="text-xs h-8">
          Etiqueta
        </TabsTrigger>
        <TabsTrigger value="padroes-sistema" className="text-xs h-8">
          Sistema
        </TabsTrigger>
      </TabsList>

      {/* ── Layout: Identidade / Layout / Cards / Fundo em seções retráteis ── */}
      <TabsContent value="layout" className="flex-1 overflow-y-auto m-0 p-3">
        <div className="flex flex-col gap-2">
          {/* Tamanho da página — sempre visível (sem retração) */}
          <div className="flex flex-col gap-2">
            <Label>Tamanho da página</Label>
            <div className="flex gap-2">
              <Button
                variant={
                  !config.pageAspect && config.pageSize === "square"
                    ? "default"
                    : "outline"
                }
                size="sm"
                className="flex-1"
                onClick={() =>
                  onConfigChange({ pageSize: "square", pageAspect: undefined })
                }
              >
                1:1 Quadrado
              </Button>
              <Button
                variant={
                  !config.pageAspect && config.pageSize === "portrait"
                    ? "default"
                    : "outline"
                }
                size="sm"
                className="flex-1"
                onClick={() =>
                  onConfigChange({
                    pageSize: "portrait",
                    pageAspect: undefined,
                  })
                }
              >
                3:4 Retrato
              </Button>
              <Button
                variant={
                  !config.pageAspect && config.pageSize === "story"
                    ? "default"
                    : "outline"
                }
                size="sm"
                className="flex-1"
                onClick={() =>
                  onConfigChange({ pageSize: "story", pageAspect: undefined })
                }
              >
                Story 9:16
              </Button>
            </div>
          </div>

          {/* Validade da oferta — sempre visível (sem retração) */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="catalog-validity">Validade da oferta</Label>
              {config.offerValidUntil && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => onConfigChange({ offerValidUntil: undefined })}
                >
                  Limpar
                </Button>
              )}
            </div>
            <Input
              id="catalog-validity"
              type="datetime-local"
              value={config.offerValidUntil ?? ""}
              onChange={(e) =>
                onConfigChange({
                  offerValidUntil: e.target.value || undefined,
                })
              }
            />
            <p className="text-[11px] text-muted-foreground">
              {config.offerValidUntil
                ? isOfferExpired(config)
                  ? "⚠️ Oferta vencida — o compartilhamento está bloqueado."
                  : "Após esta data o catálogo não poderá ser compartilhado."
                : "Sem prazo. Defina uma data/hora para expirar a oferta."}
            </p>
          </div>

          {/* Marca d'água Órbita — canto inferior livre (auto) */}
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <Label htmlFor="watermark">Marca d'água Órbita</Label>
            <Switch
              id="watermark"
              checked={config.watermark !== false}
              onCheckedChange={(v) => onConfigChange({ watermark: v })}
            />
          </div>

          {/* "Página dinâmica" foi movida para a aba "Página" (topo). */}
        </div>
      </TabsContent>

      {/* ── Fundo (propriedades do fundo da página + salvar padrão) ── */}
      <TabsContent
        value="padroes-sistema"
        className="flex-1 overflow-y-auto m-0 p-4"
      >
        <SystemTemplatesPanel
          config={config}
          onConfigChange={onConfigChange}
          captureThumbnail={captureThumbnail}
        />
      </TabsContent>

      <TabsContent value="fundo" className="flex-1 overflow-y-auto m-0 p-3">
        <div className="flex flex-col gap-3">
          <BackgroundProperties
            config={config}
            onConfigChange={onConfigChange}
          />

          {/* Salvar a aparência atual como padrão (reutilizável em novos
              catálogos via "+ Novo catálogo"). */}
          <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Salvar como padrão
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
            {/* Atualizar um padrão salvo com a aparência atual — sempre
                acessível: escolha o padrão e clique em atualizar. */}
            {templates.length > 0 && (
              <div className="flex flex-col gap-2 border-t pt-2">
                <Select
                  value={currentTemplateId ?? ""}
                  onValueChange={(v) => setCurrentTemplateId(v || null)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Atualizar um padrão salvo…" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {currentTemplateId && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full gap-1"
                    disabled={updateTemplate.isPending}
                    onClick={handleUpdateTemplate}
                  >
                    {updateTemplate.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    Atualizar{" "}
                    {currentTemplate ? `“${currentTemplate.name}”` : "padrão"}
                  </Button>
                )}
              </div>
            )}
            {onApplyStyleToAllPages && (
              <Button
                size="sm"
                variant="outline"
                className="w-full gap-1"
                disabled={pageCount <= 1}
                title="Copia o layout, a posição da grade e o fundo desta página para todas as páginas"
                onClick={onApplyStyleToAllPages}
              >
                <Layers className="h-3.5 w-3.5" />
                Aplicar padrão para todas as páginas
              </Button>
            )}
            <p className="text-[11px] text-muted-foreground">
              Guarda a aparência (layout, posição da grade, Etiquetas, cores,
              fontes, fundo…) — sem os produtos. Aparece ao criar um novo
              catálogo.
              {pageCount > 1 &&
                " “Aplicar para todas as páginas” copia o layout, a grade e o fundo desta página para as demais."}
            </p>
          </div>
        </div>
      </TabsContent>

      {/* ── Página (produtos + entidade dinâmica da página) ── */}
      <TabsContent value="produtos" className="flex-1 overflow-y-auto m-0 p-4">
        <div className="flex flex-col gap-3">
          {/* Nome da página. O vínculo dinâmico (loja/cliente) fica no FIM. */}
          {pageName && (
            <p className="truncate text-sm font-semibold" title={pageName}>
              {pageName}
            </p>
          )}
          {/* Título + Ordenação (movida do cabeçalho da página). Com grupo
              selecionado, mostra só os produtos dele + "Ver todos". */}
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {selectedGroupId ? (
                <>
                  {namedGroups.find((g) => g.id === selectedGroupId)?.name ||
                    "Grupo"}{" "}
                  ·{" "}
                  <button
                    type="button"
                    className="lowercase underline hover:text-foreground"
                    onClick={() => setSelectedGroupId(null)}
                  >
                    ver todos
                  </button>
                </>
              ) : (
                `Produtos na página (${pageProducts.length})`
              )}
            </p>
            <div className="flex shrink-0 items-center gap-1">
              <ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground" />
              <Select
                value={config.sortBy}
                onValueChange={(v) =>
                  onConfigChange({ sortBy: v as CatalogConfig["sortBy"] })
                }
              >
                <SelectTrigger
                  className="h-7 w-auto gap-1 px-2 text-xs"
                  title="Ordenação"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTS.map((o) => (
                    <SelectItem
                      key={o.value}
                      value={o.value}
                      className="text-xs"
                    >
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <AddProductDialog
            config={config}
            onConfigChange={onConfigChange}
            open={addProductOpen}
            onOpenChange={setAddProductOpen}
          />

          {/* + Adicionar Grupo — agrupa os produtos SELECIONADOS (checkbox ou
              Shift+clique) num grupo nomeado. Uma página pode ter vários. */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full gap-1"
            disabled={selectedForGroup.size === 0}
            onClick={addGroupFromSelection}
          >
            <Layers className="h-4 w-4" />
            {selectedForGroup.size > 0
              ? `Adicionar Grupo (${selectedForGroup.size})`
              : "Adicionar Grupo"}
          </Button>
          {selectedForGroup.size > 0 && (
            <p className="-mt-1 text-center text-[11px] text-muted-foreground">
              {selectedForGroup.size} selecionado(s) ·{" "}
              <button
                type="button"
                className="underline hover:text-foreground"
                onClick={() => setSelectedForGroup(new Set())}
              >
                limpar
              </button>
            </p>
          )}

          {/* Grupos existentes (nomeados) — renomear / excluir. */}
          {namedGroups.length > 0 && (
            <div className="flex flex-col gap-1.5 rounded-md border bg-muted/20 p-2">
              <button
                type="button"
                className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setGroupsCollapsed((c) => !c)}
                title={groupsCollapsed ? "Expandir" : "Recolher"}
              >
                {groupsCollapsed ? (
                  <ChevronRight className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
                Grupos da página ({namedGroups.length})
              </button>
              {!groupsCollapsed &&
                namedGroups.map((g) => {
                  const sel = selectedGroupId === g.id;
                  return (
                    <div
                      key={g.id}
                      className={cn(
                        "flex items-center gap-1 rounded-md p-1",
                        sel
                          ? "bg-primary/10 ring-1 ring-inset ring-primary/50"
                          : "hover:bg-muted/50",
                      )}
                    >
                      {/* Clicar no grupo → abre esse grupo na aba "Página" */}
                      <button
                        type="button"
                        title="Ver produtos deste grupo"
                        onClick={() => {
                          setSelectedGroupId(sel ? null : g.id);
                          onActiveTabChange?.("produtos");
                        }}
                      >
                        <Layers
                          className={cn(
                            "h-3.5 w-3.5 shrink-0",
                            sel ? "text-primary" : "text-muted-foreground",
                          )}
                        />
                      </button>
                      <Input
                        value={g.name ?? ""}
                        onChange={(e) => renameGroup(g.id, e.target.value)}
                        placeholder="Nome do grupo"
                        className="h-7 min-w-0 flex-1 text-xs"
                      />
                      {/* Fundo do grupo: cor + transparência + arredondamento +
                          contorno */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            title="Fundo do grupo (cor, transparência, cantos, contorno)"
                            className="h-6 w-6 shrink-0 rounded border"
                            style={{ background: g.bgColor ?? "transparent" }}
                          />
                        </PopoverTrigger>
                        <PopoverContent className="flex w-56 flex-col gap-2 p-3">
                          <label className="flex items-center justify-between text-[11px] text-muted-foreground">
                            Cor de fundo
                            <input
                              type="color"
                              value={g.bgColor ?? "#ffffff"}
                              onChange={(e) =>
                                updateGroup(g.id, { bgColor: e.target.value })
                              }
                              className="h-6 w-8 cursor-pointer rounded border p-0"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                            Transparência ({g.bgOpacity ?? 100}%)
                            <input
                              type="range"
                              min={0}
                              max={100}
                              value={g.bgOpacity ?? 100}
                              onChange={(e) =>
                                updateGroup(g.id, {
                                  bgOpacity: Number(e.target.value),
                                })
                              }
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                            Arredondamento ({g.radius ?? 0}px)
                            <input
                              type="range"
                              min={0}
                              max={80}
                              value={g.radius ?? 0}
                              onChange={(e) =>
                                updateGroup(g.id, {
                                  radius: Number(e.target.value),
                                })
                              }
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                            Contorno ({g.borderWidth ?? 0}px)
                            <input
                              type="range"
                              min={0}
                              max={20}
                              value={g.borderWidth ?? 0}
                              onChange={(e) =>
                                updateGroup(g.id, {
                                  borderWidth: Number(e.target.value),
                                })
                              }
                            />
                          </label>
                          {(g.borderWidth ?? 0) > 0 && (
                            <label className="flex items-center justify-between text-[11px] text-muted-foreground">
                              Cor do contorno
                              <input
                                type="color"
                                value={g.borderColor ?? "#000000"}
                                onChange={(e) =>
                                  updateGroup(g.id, {
                                    borderColor: e.target.value,
                                  })
                                }
                                className="h-6 w-8 cursor-pointer rounded border p-0"
                              />
                            </label>
                          )}
                        </PopoverContent>
                      </Popover>
                      {/* Disposição (colunas × linhas) */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            title="Disposição (colunas × linhas)"
                          >
                            <LayoutGrid className="h-3.5 w-3.5" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-2">
                          <p className="mb-2 text-[11px] font-medium text-muted-foreground">
                            Disposição
                          </p>
                          <div className="flex items-center gap-2">
                            <div className="flex flex-1 flex-col gap-1 text-[11px] text-muted-foreground">
                              Colunas
                              <Input
                                type="number"
                                min={1}
                                max={6}
                                value={g.gridCols}
                                onChange={(e) =>
                                  updateGroup(g.id, {
                                    gridCols: Math.max(
                                      1,
                                      Number(e.target.value) || 1,
                                    ),
                                  })
                                }
                                className="h-7"
                              />
                            </div>
                            <div className="flex flex-1 flex-col gap-1 text-[11px] text-muted-foreground">
                              Linhas
                              <Input
                                type="number"
                                min={1}
                                max={20}
                                value={g.gridRows}
                                onChange={(e) =>
                                  updateGroup(g.id, {
                                    gridRows: Math.max(
                                      1,
                                      Number(e.target.value) || 1,
                                    ),
                                  })
                                }
                                className="h-7"
                              />
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                      <span className="w-5 shrink-0 text-center text-[11px] tabular-nums text-muted-foreground">
                        {g.productIds?.length ?? 0}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-destructive"
                        title="Excluir grupo"
                        onClick={() => {
                          if (sel) setSelectedGroupId(null);
                          removeGroup(g.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
            </div>
          )}
          <div className="flex items-center justify-between rounded-md border px-2 py-1.5">
            <Label htmlFor="auto-promotions" className="text-xs">
              Incluir promoções automaticamente
            </Label>
            <Switch
              id="auto-promotions"
              checked={config.autoPromotions === true}
              onCheckedChange={(v) => onConfigChange({ autoPromotions: v })}
            />
          </div>
          {pageProducts.length === 0 && (
            <p className="rounded-md bg-muted/50 px-2 py-3 text-center text-xs text-muted-foreground">
              Nenhum produto nesta página. Use “Adicionar produto”.
            </p>
          )}
          <div className="flex flex-col gap-1 max-h-[calc(100vh-160px)] overflow-y-auto">
            {pageProducts.map((p, index) => {
              // Com um grupo selecionado, mostra só os produtos dele (mantém o
              // `index` do pageProducts para mover/selecionar funcionar).
              if (selectedGroupId) {
                const sg = namedGroups.find((g) => g.id === selectedGroupId);
                if (sg && !sg.productIds?.includes(p.id)) return null;
              }
              return (
                <Fragment key={p.id}>
                  <div
                    ref={
                      selection?.kind === "card" && selection.id === p.id
                        ? selectedRowRef
                        : undefined
                    }
                    className={
                      selection?.kind === "card" && selection.id === p.id
                        ? "flex gap-2 py-1.5 px-2 rounded bg-primary/5 ring-2 ring-inset ring-primary/70"
                        : "flex gap-2 py-1.5 px-2 rounded hover:bg-muted"
                    }
                  >
                    {/* Seleção p/ agrupar (Shift+clique = range) */}
                    <input
                      type="checkbox"
                      aria-label="Selecionar para agrupar"
                      checked={selectedForGroup.has(p.id)}
                      onChange={() => {}}
                      onClick={(e) =>
                        toggleProductSelect(index, p.id, e.shiftKey)
                      }
                      className="mt-1 h-4 w-4 shrink-0 cursor-pointer self-start accent-primary"
                    />
                    <ProductPhotoButton
                      product={p}
                      config={config}
                      onConfigChange={onConfigChange}
                      onSaveCardLayout={onSaveCardLayout}
                      open={editingId === p.id}
                      onOpenChange={(o) => setEditingId(o ? p.id : null)}
                      productIndex={index}
                      pageProductCount={pageProducts.length}
                      entry={editingId === p.id ? editEntry : "photo"}
                      initialElementId={
                        editingId === p.id ? editElementId : undefined
                      }
                      onPhotoClick={() => {
                        setEditEntry("photo");
                        setEditElementId(undefined);
                        setEditingId(p.id);
                      }}
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate flex-1 text-sm">
                          {p.name}
                        </span>
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
                            disabled={index === pageProducts.length - 1}
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
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          title="Montar etiqueta (editor livre)"
                          onClick={() => {
                            setEditEntry("label");
                            setEditElementId(undefined);
                            setEditingId(p.id);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      {/* Adicionar em qual grupo? (só quando a página tem grupos) */}
                      {namedGroups.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <Layers className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <select
                            value={
                              namedGroups.find((g) =>
                                g.productIds?.includes(p.id),
                              )?.id ?? ""
                            }
                            onChange={(e) => {
                              const gid = e.target.value;
                              if (gid) addProductToGroup(p.id, gid);
                              else removeProductFromGroups(p.id);
                            }}
                            title="Adicionar em qual grupo?"
                            className="h-6 min-w-0 flex-1 rounded border bg-background px-1 text-[11px]"
                          >
                            <option value="">Sem grupo</option>
                            {namedGroups.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.name || "Grupo"}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                </Fragment>
              );
            })}
          </div>

          {/* Página dinâmica (loja/cliente desta página) — no FIM da aba. */}
          <DynamicPageSection
            config={config}
            onConfigChange={onConfigChange}
            pageName={pageName}
            allPagesDynamic={allPagesDynamic}
            onAllPagesDynamic={onAllPagesDynamic}
          />
        </div>
      </TabsContent>

      {/* ── Etiqueta: biblioteca de PNGs para arrastar sobre o catálogo ── */}
      <TabsContent value="texto" className="flex-1 overflow-y-auto m-0 p-4">
        <TextProperties
          config={config}
          onConfigChange={onConfigChange}
          selection={selection}
          onSelectionChange={onSelectionChange}
        />
      </TabsContent>

      <TabsContent value="etiqueta" className="flex-1 overflow-y-auto m-0 p-4">
        <div className="flex flex-col gap-4">
          {selectedOverlay?.binding && (
            <div className="flex items-center justify-between gap-2 rounded-md border border-primary/40 bg-primary/5 px-2 py-1.5">
              <span className="truncate text-[11px] text-muted-foreground">
                Vinculado a: <b>{entityVarLabel(selectedOverlay.binding)}</b>
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-6 shrink-0 text-[11px]"
                onClick={() => updateOverlay({ binding: undefined })}
              >
                Desvincular
              </Button>
            </div>
          )}
          {selectedOverlay && (
            <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Redimensionar imagem
              </p>
              <ImageResizer
                src={selectedOverlaySrc}
                adjust={selectedOverlay.adjust}
                baseline={OVERLAY_ADJUST_BASELINE}
                onChange={setOverlayAdjust}
                onReset={() => updateOverlay({ adjust: undefined })}
                emptyLabel="Sem imagem"
                box={{
                  x: selectedOverlay.x,
                  y: selectedOverlay.y,
                  w: selectedOverlay.w,
                  h: selectedOverlay.h,
                }}
                onBoxChange={(b) =>
                  updateOverlay({ x: b.x, y: b.y, w: b.w, h: b.h })
                }
              />
            </div>
          )}
          {selectedOverlay && (
            <ElementProperties
              overlay={selectedOverlay}
              onChange={updateOverlay}
              onBringForward={() => reorderOverlay(1)}
              onSendBackward={() => reorderOverlay(-1)}
              onDelete={deleteOverlay}
              canForward={selectedOverlayIndex < overlays.length - 1}
              canBackward={selectedOverlayIndex > 0}
            />
          )}
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

      {/* ── Estilos: biblioteca de estilos de preço (meus + do sistema) ── */}
      <TabsContent value="estilos" className="flex-1 overflow-y-auto m-0 p-4">
        {/* Etiquetas dinâmicas — imagem que resolve de uma entidade da página
            dinâmica (foto da loja / logo da org / foto do produto / usuário). */}
        <div className="mb-4 flex flex-col gap-1.5 rounded-md border p-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Etiquetas dinâmicas
          </p>
          {config.dynamic?.type ? (
            <Select
              value=""
              onValueChange={(v) => {
                const variable = v as EntityImageVar;
                const source = variable.split(".")[0] as EntitySource;
                const ov = makeDynamicOverlay({ source, variable });
                onConfigChange({
                  overlays: [...(config.overlays ?? []), ov],
                });
                onSelectionChange?.({ kind: "element", id: ov.id });
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Adicionar etiqueta dinâmica…" />
              </SelectTrigger>
              <SelectContent>
                {[
                  ...ENTITY_IMAGE_VARS[config.dynamic.type],
                  ...(config.dynamic.type === "org"
                    ? []
                    : ENTITY_IMAGE_VARS.org),
                ].map((v) => (
                  <SelectItem key={v.value} value={v.value} className="text-xs">
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Ative a “Página dinâmica” na aba Layout para inserir a foto da
              loja, logo da organização, etc.
            </p>
          )}
        </div>

        <PriceStylesLibrary
          onApply={(layout) => onConfigChange({ cardLayout: layout })}
          onAdd={(layout) => {
            // "Adicionar" coloca o estilo como um BLOCO posicionável na página.
            // Nasce SEM produto — o usuário adiciona um produto real depois (em
            // "Estilos na página"), que então entra na lista de Produtos.
            const block: StyleBlock = {
              id: crypto.randomUUID(),
              x: 360,
              y: 360,
              w: 360,
              h: 360,
              rotation: 0,
              productId: "",
              cardLayout: layout.map((el) => ({
                ...el,
                id: crypto.randomUUID(),
              })),
            };
            onConfigChange({
              styleBlocks: [...(config.styleBlocks ?? []), block],
            });
          }}
        />

        {/* Blocos de estilo já colocados na página: escolher/adicionar o produto
            que cada bloco representa (também entra na aba Produtos) + remover. */}
        {(config.styleBlocks ?? []).length > 0 && (
          <div className="mt-4 flex flex-col gap-2 border-t pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Estilos na página ({(config.styleBlocks ?? []).length})
            </p>
            {(config.styleBlocks ?? []).map((block, i) => {
              const bound = products.find((p) => p.id === block.productId);
              return (
                <div
                  key={block.id}
                  className={
                    selection?.kind === "styleBlock" &&
                    selection.id === block.id
                      ? "flex items-center gap-2 rounded-md border p-2 ring-1 ring-primary/40"
                      : "flex items-center gap-2 rounded-md border p-2"
                  }
                >
                  <button
                    type="button"
                    className="h-14 w-14 shrink-0 overflow-hidden rounded border bg-muted"
                    title="Selecionar bloco no canvas"
                    onClick={() =>
                      onSelectionChange?.({
                        kind: "styleBlock",
                        id: block.id,
                      })
                    }
                  >
                    <CardFreeLayout
                      product={bound ?? SAMPLE_PRODUCT}
                      elements={block.cardLayout}
                    />
                  </button>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-xs font-medium">Estilo {i + 1}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {bound ? bound.name : "Sem produto"}
                    </span>
                    <AddProductDialog
                      config={config}
                      onConfigChange={onConfigChange}
                      triggerLabel={
                        bound ? "Trocar produto" : "Adicionar produto"
                      }
                      title="Produto do bloco de estilo"
                      onPicked={(id) =>
                        onConfigChange({
                          styleBlocks: (config.styleBlocks ?? []).map((b) =>
                            b.id === block.id ? { ...b, productId: id } : b,
                          ),
                        })
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-destructive"
                    title="Remover bloco"
                    onClick={() =>
                      onConfigChange({
                        styleBlocks: (config.styleBlocks ?? []).filter(
                          (b) => b.id !== block.id,
                        ),
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
