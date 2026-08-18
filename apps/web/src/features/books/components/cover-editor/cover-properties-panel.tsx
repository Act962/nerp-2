"use client";

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Crop,
  ImageUp,
  Trash2,
} from "lucide-react";
import { useRef, useState } from "react";
import { PhotoAdjustDialog } from "../book-pages/photo-adjust-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  BOOK_FONT_FAMILIES,
  DEFAULT_FONT_FAMILY,
  type BookFontFamily,
  type CoverElement,
  type CoverImageSource,
} from "../../lib/cover-layout";
import {
  ColorField,
  EDITOR_BUTTON_CLASS,
  EDITOR_SELECT_CLASS,
  NumberField,
} from "./editor-controls";
import { VariableMenu } from "./variable-menu";

interface CoverPropertiesPanelProps {
  element: CoverElement | null;
  onChange: (id: string, patch: Partial<CoverElement>) => void;
  onDelete: (id: string) => void;
  onReplaceImage: (id: string, file: File) => void;
  // Foto real que preenche cada espaço no preview — sem ela não há o que
  // cortar, e o botão de recorte some.
  photoPreviewUrls?: string[];
  // slotIndex de cada espaço de foto do layout — alimenta o select "Foto de
  // referência" dos textos.
  photoSlotIndexes?: number[];
  allowItemScope: boolean;
}

const ELEMENT_LABELS: Record<CoverElement["type"], string> = {
  text: "Texto",
  image: "Imagem",
  divider: "Linha divisória",
  shape: "Forma",
  photoSlot: "Espaço de foto",
};

function FontFamilySelect({
  value,
  onChange,
}: {
  value: BookFontFamily;
  onChange: (value: BookFontFamily) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs">Fonte</Label>
      <Select
        value={value}
        onValueChange={(next) => onChange(next as BookFontFamily)}
      >
        <SelectTrigger className={cn("w-full", EDITOR_SELECT_CLASS)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {BOOK_FONT_FAMILIES.map((font) => (
            <SelectItem key={font.value} value={font.value}>
              {font.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function CoverPropertiesPanel({
  element,
  onChange,
  onDelete,
  onReplaceImage,
  photoPreviewUrls,
  photoSlotIndexes,
  allowItemScope,
}: CoverPropertiesPanelProps) {
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [croppingOpen, setCroppingOpen] = useState(false);

  if (!element) {
    return (
      <p className="text-sm text-muted-foreground">
        Toque num elemento do canvas pra editar.
      </p>
    );
  }

  const patch = (value: Partial<CoverElement>) => onChange(element.id, value);

  const appendToken = (token: string) => {
    if (element.type !== "text" && element.type !== "shape") return;
    patch({ text: element.text ? `${element.text} ${token}` : token });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{ELEMENT_LABELS[element.type]}</p>
        <Button
          variant="ghost"
          size="icon"
          className="size-11 md:size-9"
          onClick={() => onDelete(element.id)}
          title="Remover elemento"
        >
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </div>

      {(element.type === "text" || element.type === "shape") && (
        <>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">
                {element.type === "shape" ? "Texto dentro da forma" : "Texto"}
              </Label>
              <VariableMenu
                onInsert={appendToken}
                allowItemScope={allowItemScope}
              />
            </div>
            <Textarea
              value={element.text}
              onChange={(event) => patch({ text: event.target.value })}
              rows={2}
              className="text-base md:text-sm"
              placeholder="Digite ou insira uma variável"
            />
          </div>
          <FontFamilySelect
            value={element.fontFamily ?? DEFAULT_FONT_FAMILY}
            onChange={(fontFamily) => patch({ fontFamily })}
          />
        </>
      )}

      {element.type === "text" &&
        allowItemScope &&
        (photoSlotIndexes?.length ?? 0) > 0 && (
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Foto de referência</Label>
            <Select
              value={
                element.photoRef != null ? String(element.photoRef) : "page"
              }
              onValueChange={(value) =>
                patch({
                  photoRef: value === "page" ? undefined : Number(value),
                })
              }
            >
              <SelectTrigger className={cn("w-full", EDITOR_SELECT_CLASS)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="page">Página (padrão)</SelectItem>
                {photoSlotIndexes?.map((slotIndex) => (
                  <SelectItem key={slotIndex} value={String(slotIndex)}>
                    Foto {slotIndex + 1}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              {
                "{{numeroFoto}}, {{cidade}}, {{uf}} e {{promotor}} resolvem por esta foto."
              }
            </p>
          </div>
        )}

      {element.type === "text" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Tamanho da fonte"
              value={element.fontSize}
              min={8}
              max={120}
              onChange={(fontSize) => patch({ fontSize })}
            />
            <ColorField
              label="Cor"
              value={element.color}
              onChange={(color) => patch({ color })}
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              variant={element.fontWeight === "bold" ? "default" : "outline"}
              size="icon"
              className="size-11 md:size-9"
              title="Negrito"
              onClick={() =>
                patch({
                  fontWeight: element.fontWeight === "bold" ? "normal" : "bold",
                })
              }
            >
              <Bold className="size-4" />
            </Button>
            <Button
              type="button"
              variant={element.align === "left" ? "default" : "outline"}
              size="icon"
              className="size-11 md:size-9"
              title="Alinhar à esquerda"
              onClick={() => patch({ align: "left" })}
            >
              <AlignLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant={element.align === "center" ? "default" : "outline"}
              size="icon"
              className="size-11 md:size-9"
              title="Centralizar"
              onClick={() => patch({ align: "center" })}
            >
              <AlignCenter className="size-4" />
            </Button>
            <Button
              type="button"
              variant={element.align === "right" ? "default" : "outline"}
              size="icon"
              className="size-11 md:size-9"
              title="Alinhar à direita"
              onClick={() => patch({ align: "right" })}
            >
              <AlignRight className="size-4" />
            </Button>
            <Button
              type="button"
              variant={element.uppercase ? "default" : "outline"}
              size="sm"
              className={cn("ml-auto text-xs", EDITOR_BUTTON_CLASS)}
              onClick={() => patch({ uppercase: !element.uppercase })}
            >
              MAIÚSCULAS
            </Button>
          </div>
        </>
      )}

      {element.type === "shape" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <ColorField
              label="Preenchimento"
              value={element.fill}
              onChange={(fill) => patch({ fill })}
            />
            <ColorField
              label="Contorno"
              value={element.strokeColor}
              onChange={(strokeColor) => patch({ strokeColor })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">
              Opacidade do preenchimento ·{" "}
              {Math.round(element.fillOpacity * 100)}%
            </Label>
            <Slider
              value={[element.fillOpacity]}
              min={0}
              max={1}
              step={0.05}
              onValueChange={([fillOpacity]) => patch({ fillOpacity })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Espessura do contorno"
              value={element.strokeWidth}
              min={0}
              max={40}
              onChange={(strokeWidth) => patch({ strokeWidth })}
            />
            <NumberField
              label="Tamanho da fonte"
              value={element.fontSize}
              min={8}
              max={120}
              onChange={(fontSize) => patch({ fontSize })}
            />
          </div>
          <ColorField
            label="Cor do texto"
            value={element.fontColor}
            onChange={(fontColor) => patch({ fontColor })}
          />
        </>
      )}

      {element.type === "image" && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Origem da imagem</Label>
            <Select
              value={element.imageSource ?? "upload"}
              onValueChange={(source) =>
                patch({ imageSource: source as CoverImageSource })
              }
            >
              <SelectTrigger className={cn("w-full", EDITOR_SELECT_CLASS)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="upload">Imagem enviada</SelectItem>
                <SelectItem value="organization">
                  Logo da organização
                </SelectItem>
                <SelectItem value="supplier">Logo da indústria</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {element.imageSource === "organization" ||
              element.imageSource === "supplier"
                ? "O espaço puxa o logo cadastrado — fica vazio se não houver um."
                : "Use “Trocar imagem” para enviar um arquivo."}
            </p>
          </div>
          <Button
            variant="outline"
            className={cn("gap-2", EDITOR_BUTTON_CLASS)}
            onClick={() => replaceInputRef.current?.click()}
          >
            <ImageUp className="size-4" /> Trocar imagem
          </Button>
          <input
            ref={replaceInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onReplaceImage(element.id, file);
              event.target.value = "";
            }}
          />
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Enquadramento</Label>
            <Select
              value={element.objectFit}
              onValueChange={(objectFit) =>
                patch({ objectFit: objectFit as "cover" | "contain" })
              }
            >
              <SelectTrigger className={cn("w-full", EDITOR_SELECT_CLASS)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contain">Caber inteira</SelectItem>
                <SelectItem value="cover">
                  Preencher (corta as bordas)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {element.type === "photoSlot" && (
        <>
          <NumberField
            label="Número da foto (1 = primeira do PDV)"
            value={element.slotIndex + 1}
            min={1}
            max={12}
            onChange={(value) =>
              patch({ slotIndex: Math.max(0, Math.round(value) - 1) })
            }
          />
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Enquadramento</Label>
            <Select
              value={element.objectFit}
              onValueChange={(objectFit) =>
                patch({ objectFit: objectFit as "cover" | "contain" })
              }
            >
              <SelectTrigger className={cn("w-full", EDITOR_SELECT_CLASS)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cover">
                  Preencher (corta as bordas)
                </SelectItem>
                <SelectItem value="contain">Caber inteira</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Checkbox
              id="slot-show-number"
              checked={element.showNumber !== false}
              onCheckedChange={(checked) =>
                patch({ showNumber: checked === true })
              }
            />
            <Label htmlFor="slot-show-number" className="text-xs">
              Mostrar número da foto (FOTO N)
            </Label>
          </div>
          <NumberField
            label="Cantos arredondados (0 = quadrado)"
            value={element.cornerRadius}
            min={0}
            max={120}
            onChange={(cornerRadius) => patch({ cornerRadius })}
          />
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">
              Zoom da foto dentro do espaço (
              {(element.imageScale ?? 1).toFixed(1)}×)
            </Label>
            <Slider
              value={[element.imageScale ?? 1]}
              min={1}
              max={3}
              step={0.1}
              onValueChange={([imageScale]) => patch({ imageScale })}
            />
          </div>
          {photoPreviewUrls?.[element.slotIndex] && (
            <>
              <Button
                variant="outline"
                className={cn("gap-2", EDITOR_BUTTON_CLASS)}
                onClick={() => setCroppingOpen(true)}
              >
                <Crop className="size-4" /> Cortar foto
              </Button>
              <PhotoAdjustDialog
                open={croppingOpen}
                onOpenChange={setCroppingOpen}
                photoUrl={photoPreviewUrls[element.slotIndex]}
                aspectRatio={element.width / element.height}
                initialAdjustment={{
                  zoom: element.imageScale ?? 1,
                  posX: element.imageOffsetX ?? 50,
                  posY: element.imageOffsetY ?? 50,
                }}
                onSave={(adjustment) =>
                  patch({
                    imageScale: adjustment.zoom,
                    imageOffsetX: adjustment.posX,
                    imageOffsetY: adjustment.posY,
                  })
                }
              />
            </>
          )}
          <NumberField
            label="Espessura do contorno (0 = sem contorno)"
            value={element.strokeWidth ?? 0}
            min={0}
            max={24}
            onChange={(strokeWidth) => patch({ strokeWidth })}
          />
          {(element.strokeWidth ?? 0) > 0 && (
            <>
              <ColorField
                label="Cor do contorno"
                value={element.strokeColor ?? "#1a1a1a"}
                onChange={(strokeColor) => patch({ strokeColor })}
              />
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Traço do contorno</Label>
                <Select
                  value={element.strokeDashed ? "dashed" : "solid"}
                  onValueChange={(value) =>
                    patch({ strokeDashed: value === "dashed" })
                  }
                >
                  <SelectTrigger className={cn("w-full", EDITOR_SELECT_CLASS)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solid">Contínuo</SelectItem>
                    <SelectItem value="dashed">Segmentado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </>
      )}

      {element.type === "divider" && (
        <ColorField
          label="Cor"
          value={element.color}
          onChange={(color) => patch({ color })}
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="Largura"
          value={Math.round(element.width)}
          onChange={(width) => patch({ width })}
        />
        <NumberField
          label="Altura"
          value={Math.round(element.height)}
          onChange={(height) => patch({ height })}
        />
      </div>
    </div>
  );
}
