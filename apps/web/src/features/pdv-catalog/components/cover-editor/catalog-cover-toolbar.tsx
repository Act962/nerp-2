"use client";

import { Button } from "@/components/ui/button";
import { ImagePlus, Loader2, Type } from "lucide-react";
import type { ReactNode } from "react";
import { useRef } from "react";

interface CatalogCoverToolbarProps {
  onAddText: () => void;
  onAddImage: (file: File) => void;
  isUploadingImage: boolean;
  saveStatus: "idle" | "saving" | "saved";
  backgroundControl?: ReactNode;
}

export function CatalogCoverToolbar({
  onAddText,
  onAddImage,
  isUploadingImage,
  saveStatus,
  backgroundControl,
}: CatalogCoverToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={onAddText} className="gap-2">
        <Type className="size-4" /> Texto
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
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
      {backgroundControl}
      <span className="ml-auto text-xs text-muted-foreground">
        {saveStatus === "saving" && "Salvando…"}
        {saveStatus === "saved" && "Salvo"}
      </span>
    </div>
  );
}
