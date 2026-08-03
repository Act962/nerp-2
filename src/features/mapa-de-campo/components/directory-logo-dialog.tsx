"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { constructUrl } from "@/hooks/use-construct-url";
import { compressImage } from "@/lib/compress-image";
import { uploadToR2 } from "@/lib/upload-to-r2";
import { ImagePlus, Store as StoreIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useSetDirectoryLogo } from "../hooks/use-mapa-de-campo";
import type { DirectoryPin } from "./field-map-canvas";

/**
 * Logo do varejo GLOBAL, restrita à administração do TradeGram.
 *
 * O padrão é a rede inteira: trocar a bandeira de uma loja e deixar as outras
 * 26 erradas é justamente o incômodo que motivou isto. Quem quiser só uma troca
 * o escopo à mão.
 */
export function DirectoryLogoDialog({
  pin,
  open,
  onOpenChange,
}: {
  pin: DirectoryPin | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scope, setScope] = useState<"COMPANY" | "POINT">("COMPANY");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const save = useSetDirectoryLogo();
  const busy = uploading || save.isPending;

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setScope("COMPANY");
  }, [open]);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!pin) return null;

  const shown = preview ?? (pin.logoKey ? constructUrl(pin.logoKey) : null);

  const submit = async () => {
    if (!file) return;
    setUploading(true);
    let key: string;
    try {
      key = await uploadToR2(await compressImage(file), true);
    } catch {
      setUploading(false);
      toast.error("Não foi possível enviar a imagem, tente novamente");
      return;
    }
    setUploading(false);
    save.mutate(
      {
        directoryStoreId: pin.id,
        scope: pin.companyName ? scope : "POINT",
        logoKey: key,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Logo de {pin.name}</DialogTitle>
          <DialogDescription>
            Este ponto é do catálogo do TradeGram — a logo aparece no mapa de
            todas as empresas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4">
          <div className="flex size-20 items-center justify-center overflow-hidden rounded-full border-2 border-dashed bg-muted">
            {shown ? (
              // biome-ignore lint/performance/noImgElement: preview local e URL do R2
              <img src={shown} alt="" className="size-full object-cover" />
            ) : (
              <StoreIcon className="size-7 text-muted-foreground" />
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            className="gap-1.5"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus className="size-4" />
            {shown ? "Escolher outra" : "Escolher imagem"}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              event.target.value = "";
            }}
          />
        </div>

        {/* Sem rede não há escolha a fazer — o ponto é o único alvo possível. */}
        {pin.companyName && (
          <RadioGroup
            value={scope}
            onValueChange={(value) => setScope(value as "COMPANY" | "POINT")}
            className="gap-2"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="COMPANY" id="escopo-rede" />
              <Label htmlFor="escopo-rede" className="font-normal">
                Aplicar a toda a rede {pin.companyName}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="POINT" id="escopo-ponto" />
              <Label htmlFor="escopo-ponto" className="font-normal">
                Só nesta loja
              </Label>
            </div>
          </RadioGroup>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="button" disabled={busy || !file} onClick={submit}>
            {busy && <Spinner />}
            {uploading ? "Enviando…" : "Salvar logo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
