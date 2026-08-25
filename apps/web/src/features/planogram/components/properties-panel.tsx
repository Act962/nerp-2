"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BookmarkPlus,
  Copy,
  ImagePlus,
  Minus,
  Move,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { packShelf, shelfClearanceMm } from "../engine/packing";
import { hasStaleDimensions } from "../engine/item-style";
import { usePlanogramStore } from "../engine/planogram-store-context";
import type { ProductRef } from "../engine/types";
import { DEFAULT_BEAM_HEX, DEFAULT_UPRIGHT_HEX } from "../engine/rack-colors";
import { formatMm, parseCmToMm } from "../engine/units";
import { ColorField } from "./color-field";
import { SaveTemplateDialog } from "./save-template-dialog";

interface PropertiesPanelProps {
  /** Abre "Medidas e foto do produto" para o item selecionado na gôndola. */
  onEditProduct: (product: ProductRef) => void;
}

export function PropertiesPanel({ onEditProduct }: PropertiesPanelProps) {
  const [templateDialogFixtureId, setTemplateDialogFixtureId] = useState<
    string | null
  >(null);
  const selection = usePlanogramStore((state) => state.selection);
  const items = usePlanogramStore((state) => state.items);
  const shelves = usePlanogramStore((state) => state.shelves);
  const products = usePlanogramStore((state) => state.products);
  const order = usePlanogramStore((state) => state.order);
  const fixtures = usePlanogramStore((state) => state.fixtures);
  const modules = usePlanogramStore((state) => state.modules);

  const setItemFacings = usePlanogramStore((state) => state.setItemFacings);
  const updateItem = usePlanogramStore((state) => state.updateItem);
  const removeItem = usePlanogramStore((state) => state.removeItem);
  const updateShelf = usePlanogramStore((state) => state.updateShelf);
  const removeShelf = usePlanogramStore((state) => state.removeShelf);
  const addShelf = usePlanogramStore((state) => state.addShelf);
  const duplicateShelf = usePlanogramStore((state) => state.duplicateShelf);
  const updateFixture = usePlanogramStore((state) => state.updateFixture);
  const setFixtureHeight = usePlanogramStore((state) => state.setFixtureHeight);

  if (selection.kind === "item" && selection.ids[0]) {
    const item = items[selection.ids[0]];
    if (!item) return <Empty />;
    const product = products[item.productId];
    const stale = hasStaleDimensions(item, product);

    return (
      <div className="space-y-4 p-3">
        <div>
          <p className="text-sm font-medium">{product?.name ?? "Produto"}</p>
          <p className="text-xs text-muted-foreground">
            {product?.brandName ?? "Sem marca"}
            {product?.barcode ? ` · ${product.barcode}` : ""}
          </p>
        </div>

        {stale && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs">
            <p className="font-medium text-amber-700">Medida desatualizada</p>
            <p className="text-muted-foreground">
              O cadastro do produto mudou depois que ele foi posicionado. O
              planograma mantém a medida original.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2 w-full"
              onClick={() =>
                updateItem(item.id, {
                  widthMm: product?.widthMm ?? item.widthMm,
                  heightMm: product?.heightMm ?? item.heightMm,
                  depthMm: product?.depthMm ?? item.depthMm,
                })
              }
            >
              Atualizar medidas
            </Button>
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs">Frentes</Label>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              onClick={() => setItemFacings(item.id, item.facings - 1)}
            >
              <Minus className="size-4" />
            </Button>
            <span className="w-10 text-center text-sm font-medium tabular-nums">
              {item.facings}
            </span>
            <Button
              size="icon"
              variant="outline"
              onClick={() => setItemFacings(item.id, item.facings + 1)}
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="Empilhado"
            value={item.facingsHigh}
            onChange={(value) =>
              updateItem(item.id, { facingsHigh: Math.max(1, value) })
            }
          />
          <NumberField
            label="Profundidade"
            value={item.facingsDeep}
            onChange={(value) =>
              updateItem(item.id, { facingsDeep: Math.max(1, value) })
            }
          />
        </div>

        <div className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
          Ocupa {formatMm(item.widthMm * item.facings)} de linear ·{" "}
          {formatMm(item.heightMm * item.facingsHigh)} de altura
        </div>

        {product && (
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={() => onEditProduct(product)}
          >
            <ImagePlus className="size-4" />
            Medidas e foto do produto
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 text-destructive"
          onClick={() => removeItem(item.id)}
        >
          <Trash2 className="size-4" />
          Remover da prateleira
        </Button>
      </div>
    );
  }

  if (selection.kind === "fixture" && selection.ids[0]) {
    const fixture = fixtures[selection.ids[0]];
    if (!fixture) return <Empty />;
    const fixtureModuleIds = order.modulesByFixture[fixture.id] ?? [];
    const shelfCount = fixtureModuleIds.reduce(
      (total, id) => total + (order.shelvesByModule[id]?.length ?? 0),
      0,
    );

    return (
      <div className="space-y-4 p-3">
        <div>
          <p className="text-sm font-medium">{fixture.name}</p>
          <p className="text-xs text-muted-foreground">
            {fixtureModuleIds.length} módulo(s) · {shelfCount} prateleira(s)
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* A key remonta o campo quando a altura muda por outro caminho
              (botão de ajuste rápido), senão o defaultValue ficaria defasado. */}
          <MmField
            key={fixture.heightMm}
            label="Altura"
            valueMm={fixture.heightMm}
            onChange={(mm) => setFixtureHeight(fixture.id, mm)}
          />
          <MmField
            label="Profundidade"
            valueMm={fixture.depthMm}
            onChange={(mm) => updateFixture(fixture.id, { depthMm: mm })}
          />
          <MmField
            label="Altura do rodapé"
            valueMm={fixture.baseHeightMm}
            onChange={(mm) => updateFixture(fixture.id, { baseHeightMm: mm })}
          />
        </div>

        <ColorField
          label="Cor dos montantes"
          valueHex={fixture.colorHex}
          defaultHex={DEFAULT_UPRIGHT_HEX}
          onChange={(hex) => updateFixture(fixture.id, { colorHex: hex })}
        />

        <div className="space-y-1.5">
          <Label className="text-xs">Ajuste rápido da altura</Label>
          <div className="flex gap-1.5">
            {[1600, 1900, 2200, 2500].map((heightMm) => (
              <Button
                key={heightMm}
                size="sm"
                variant={fixture.heightMm === heightMm ? "default" : "outline"}
                className="flex-1 px-0 text-[11px]"
                onClick={() => setFixtureHeight(fixture.id, heightMm)}
              >
                {formatMm(heightMm, { unit: false })}
              </Button>
            ))}
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          className="w-full gap-2"
          onClick={() => setTemplateDialogFixtureId(fixture.id)}
        >
          <BookmarkPlus className="size-4" />
          Salvar gôndola como padrão
        </Button>

        <p className="text-[10px] text-muted-foreground">
          Reduzir a altura reassenta as prateleiras que ficariam acima do teto —
          nenhuma é descartada.
        </p>

        <SaveTemplateDialog
          open={templateDialogFixtureId === fixture.id}
          onOpenChange={(open) => !open && setTemplateDialogFixtureId(null)}
          fixtureId={fixture.id}
        />
      </div>
    );
  }

  if (selection.kind === "shelf" && selection.ids[0]) {
    const shelf = shelves[selection.ids[0]];
    if (!shelf) return <Empty />;
    const moduleNode = modules[shelf.moduleId];
    const fixture = moduleNode ? fixtures[moduleNode.fixtureId] : undefined;
    const siblings = (order.shelvesByModule[shelf.moduleId] ?? [])
      .map((id) => shelves[id])
      .filter(Boolean);
    const shelfItems = (order.itemsByShelf[shelf.id] ?? [])
      .map((id) => items[id])
      .filter(Boolean);
    const clearanceMm = fixture
      ? shelfClearanceMm(shelf, siblings, fixture.heightMm)
      : 0;
    const packed = packShelf(shelf, shelfItems, { clearanceMm });

    return (
      <div className="space-y-4 p-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Prateleira {shelf.index + 1}</p>
          {packed.overflowMm > 0 && (
            <Badge variant="destructive" className="text-[10px]">
              +{formatMm(packed.overflowMm)}
            </Badge>
          )}
        </div>

        <div className="rounded-md bg-muted/50 p-2 text-xs">
          <p>
            Ocupado: {formatMm(packed.usedMm)} de {formatMm(shelf.widthMm)}
          </p>
          <p className="text-muted-foreground">
            Livre: {formatMm(packed.freeMm)} · Vão: {formatMm(clearanceMm)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <MmField
            label="Largura"
            valueMm={shelf.widthMm}
            onChange={(mm) => updateShelf(shelf.id, { widthMm: mm })}
          />
          <MmField
            label="Profundidade"
            valueMm={shelf.depthMm}
            onChange={(mm) => updateShelf(shelf.id, { depthMm: mm })}
          />
          <MmField
            label="Altura do piso"
            valueMm={shelf.yMm}
            onChange={(mm) => updateShelf(shelf.id, { yMm: mm })}
          />
          <MmField
            label="Espessura"
            valueMm={shelf.thicknessMm}
            onChange={(mm) => updateShelf(shelf.id, { thicknessMm: mm })}
          />
        </div>

        <ColorField
          label="Cor da longarina"
          valueHex={shelf.colorHex}
          defaultHex={DEFAULT_BEAM_HEX}
          onChange={(hex) => updateShelf(shelf.id, { colorHex: hex })}
        />

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-2"
            title="Cria uma cópia desta prateleira no vão acima, já selecionada para arrastar"
            onClick={() => duplicateShelf(shelf.id)}
          >
            <Copy className="size-4" />
            Duplicar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-2 text-destructive"
            onClick={() => removeShelf(shelf.id)}
          >
            <Trash2 className="size-4" />
            Remover
          </Button>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="w-full gap-2"
          onClick={() => addShelf(shelf.moduleId)}
        >
          <Plus className="size-4" />
          Nova prateleira vazia
        </Button>

        <p className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
          <Move className="mt-0.5 size-3 shrink-0" />
          Arraste a longarina laranja para cima ou para baixo no desenho para
          reposicionar o nível.
        </p>

        {shelfItems.length > 0 && (
          <p className="text-[10px] text-muted-foreground">
            Remover a prateleira move {shelfItems.length} produto(s) para "não
            posicionados" — nada é descartado.
          </p>
        )}
      </div>
    );
  }

  return <Empty />;
}

function Empty() {
  return (
    <p className="p-3 text-sm text-muted-foreground">
      Selecione um montante, uma prateleira ou um produto no canvas.
    </p>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        min={1}
        value={value}
        className="h-8"
        onChange={(event) => onChange(Number(event.target.value) || 1)}
      />
    </div>
  );
}

/** Entrada em centímetro, armazenamento em milímetro — a fronteira é aqui. */
function MmField({
  label,
  valueMm,
  onChange,
}: {
  label: string;
  valueMm: number;
  onChange: (mm: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label} (cm)</Label>
      <Input
        defaultValue={formatMm(valueMm, { unit: false })}
        className="h-8"
        onBlur={(event) => {
          const mm = parseCmToMm(event.target.value);
          if (mm != null) onChange(mm);
        }}
      />
    </div>
  );
}
