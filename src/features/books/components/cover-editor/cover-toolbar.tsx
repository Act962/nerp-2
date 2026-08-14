"use client";

import { ImagePlus, ImagePlay, Loader2, Star, Tag, Type } from "lucide-react";
import type { ReactNode } from "react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import type { CoverShapeKind } from "../../lib/cover-layout";
import { EDITOR_BUTTON_CLASS } from "./editor-controls";
import { ShapeMenu } from "./shape-menu";

interface CoverToolbarProps {
  onAddText: () => void;
  onAddImage: (file: File) => void;
  onAddShape: (kind: CoverShapeKind) => void;
  onAddPhotoSlot?: () => void;
  onImportBrands: () => void;
  canImportBrands: boolean;
  onSetDefault?: () => void;
  setDefaultLabel?: string;
  isUploadingImage: boolean;
  saveStatus: "idle" | "saving" | "saved";
  backgroundControl?: ReactNode;
}

export function CoverToolbar({
  onAddText,
  onAddImage,
  onAddShape,
  onAddPhotoSlot,
  onImportBrands,
  canImportBrands,
  onSetDefault,
  setDefaultLabel,
  isUploadingImage,
  saveStatus,
  backgroundControl,
}: CoverToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-2">
      {/* Rola na horizontal no celular em vez de quebrar em quatro linhas e
          empurrar o canvas pra fora da tela. */}
      <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAddText}
          className={`shrink-0 gap-2 ${EDITOR_BUTTON_CLASS}`}
        >
          <Type className="size-4" /> Texto
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={`shrink-0 gap-2 ${EDITOR_BUTTON_CLASS}`}
          disabled={isUploadingImage}
          onClick={() => fileInputRef.current?.click()}
        >
          {isUploadingImage ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ImagePlus className="size-4" />
          )}
          Imagem
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onAddImage(file);
            event.target.value = "";
          }}
        />
        <div className="shrink-0">
          <ShapeMenu onAdd={onAddShape} />
        </div>
        {onAddPhotoSlot && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={`shrink-0 gap-2 ${EDITOR_BUTTON_CLASS}`}
            onClick={onAddPhotoSlot}
            title="Espaço que recebe a foto do PDV em cada página"
          >
            <ImagePlay className="size-4" /> Espaço de foto
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={`shrink-0 gap-2 ${EDITOR_BUTTON_CLASS}`}
          disabled={!canImportBrands}
          onClick={onImportBrands}
          title={canImportBrands ? undefined : "Book sem indústria vinculada"}
        >
          <Tag className="size-4" /> Importar marcas
        </Button>
        <div className="shrink-0">{backgroundControl}</div>
        {onSetDefault && setDefaultLabel && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={`shrink-0 gap-2 ${EDITOR_BUTTON_CLASS}`}
            onClick={onSetDefault}
          >
            <Star className="size-4" /> {setDefaultLabel}
          </Button>
        )}
      </div>
      <span className="text-xs text-muted-foreground">
        {saveStatus === "saving" && "Salvando…"}
        {saveStatus === "saved" && "Salvo"}
      </span>
    </div>
  );
}
