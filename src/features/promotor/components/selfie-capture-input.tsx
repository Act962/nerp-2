"use client";

import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { ImagePlus, SmilePlus } from "lucide-react";
import { useRef } from "react";

/**
 * Captura da foto de perfil. Existe separado do `PhotoCaptureInput` do PDV por
 * dois motivos que não são cosméticos: `capture="user"` abre a câmera FRONTAL
 * (a do PDV abre a traseira) e aqui só cabe um arquivo. O rótulo diz "selfie"
 * em todo lugar justamente para o promotor não confundir com a foto da loja.
 */
export function SelfieCaptureInput({
  onFile,
  disabled,
}: {
  onFile: (file: File) => void;
  disabled?: boolean;
}) {
  const isMobile = useIsMobile();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (file) onFile(file);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isMobile && (
        <>
          <Button
            type="button"
            className="h-11 flex-1 gap-2"
            disabled={disabled}
            onClick={() => cameraInputRef.current?.click()}
          >
            <SmilePlus className="size-4" />
            Tirar selfie
          </Button>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={(event) => {
              handleChange(event.target.files);
              event.target.value = "";
            }}
          />
        </>
      )}

      <Button
        type="button"
        variant={isMobile ? "outline" : "default"}
        className="h-11 flex-1 gap-2"
        disabled={disabled}
        onClick={() => galleryInputRef.current?.click()}
      >
        <ImagePlus className="size-4" />
        {isMobile ? "Galeria" : "Escolher foto do rosto"}
      </Button>
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          handleChange(event.target.files);
          event.target.value = "";
        }}
      />
    </div>
  );
}
