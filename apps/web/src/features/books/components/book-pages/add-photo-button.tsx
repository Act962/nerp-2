"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Camera, ImagePlus, Loader2, Plus } from "lucide-react";

interface AddPhotoButtonProps {
  isMobile: boolean;
  isUploading: boolean;
  onCamera: () => void;
  onGallery: () => void;
  className?: string;
  iconWrapperClassName?: string;
}

// Um botão só. No desktop abre o seletor de arquivos direto; no celular abre
// as duas opções, porque `capture` e `multiple` não convivem no mesmo input —
// a câmera precisa de um input próprio e a galeria de outro.
export function AddPhotoButton({
  isMobile,
  isUploading,
  onCamera,
  onGallery,
  className,
  iconWrapperClassName,
}: AddPhotoButtonProps) {
  const icon = isUploading ? (
    <Loader2 className="size-5 animate-spin" />
  ) : (
    <Plus className="size-5" />
  );
  const content = iconWrapperClassName ? (
    <span className={iconWrapperClassName}>{icon}</span>
  ) : (
    icon
  );

  if (!isMobile) {
    return (
      <button
        type="button"
        disabled={isUploading}
        onClick={onGallery}
        title="Adicionar foto"
        className={className}
      >
        {content}
      </button>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={isUploading}
          title="Adicionar foto"
          className={className}
        >
          {content}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-1">
        <button
          type="button"
          onClick={onCamera}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm hover:bg-muted"
        >
          <Camera className="size-4" />
          Tirar foto
        </button>
        <button
          type="button"
          onClick={onGallery}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm hover:bg-muted"
        >
          <ImagePlus className="size-4" />
          Escolher da galeria
        </button>
      </PopoverContent>
    </Popover>
  );
}
