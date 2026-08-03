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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { compressImage } from "@/lib/compress-image";
import { uploadToR2 } from "@/lib/upload-to-r2";
import { ImagePlus, Store as StoreIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useCreateStoreAtPoint } from "../hooks/use-mapa-de-campo";

export interface PickedPoint {
  latitude: number;
  longitude: number;
}

/**
 * Cadastro do cliente pelo ponto clicado no mapa.
 *
 * O endereço não é pedido: o servidor resolve pelo ponto. Quem está marcando já
 * disse a única coisa que o sistema não consegue adivinhar — onde a loja fica.
 */
export function NewStoreDialog({
  point,
  open,
  onOpenChange,
}: {
  point: PickedPoint | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const create = useCreateStoreAtPoint();
  const busy = uploading || create.isPending;

  useEffect(() => {
    if (!open) return;
    setName("");
    setFile(null);
    setError(null);
  }, [open]);

  // Object URL criada dentro do efeito para o cleanup revogar exatamente a que
  // saiu de uso.
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const submit = async () => {
    setError(null);
    if (name.trim().length < 2) {
      setError("Informe o nome do supermercado");
      return;
    }
    if (!point) return;

    let coverImageKey: string | null = null;
    if (file) {
      setUploading(true);
      try {
        coverImageKey = await uploadToR2(await compressImage(file), true);
      } catch {
        setUploading(false);
        toast.error("Não foi possível enviar a foto, tente novamente");
        return;
      }
      setUploading(false);
    }

    create.mutate(
      {
        name: name.trim(),
        latitude: point.latitude,
        longitude: point.longitude,
        coverImageKey,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo cliente no mapa</DialogTitle>
          <DialogDescription>
            O endereço é preenchido a partir do ponto que você marcou.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="novo-cliente-nome">Supermercado</FieldLabel>
            <Input
              id="novo-cliente-nome"
              value={name}
              autoFocus
              placeholder="Ex.: Supermercado Coelho — Centro"
              onChange={(event) => setName(event.target.value)}
              disabled={busy}
            />
          </Field>

          <Field>
            <FieldLabel>Foto ou logo</FieldLabel>
            <FieldDescription>
              Vira a arte do pino no mapa, no lugar da bolinha.
            </FieldDescription>
            <div className="flex items-center gap-3">
              <div className="flex size-16 items-center justify-center overflow-hidden rounded-full border-2 border-dashed bg-muted">
                {preview ? (
                  // biome-ignore lint/performance/noImgElement: preview local (objectURL)
                  <img
                    src={preview}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <StoreIcon className="size-6 text-muted-foreground" />
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
                {file ? "Trocar foto" : "Escolher foto"}
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
          </Field>

          {point && (
            <p className="text-xs tabular-nums text-muted-foreground">
              Ponto marcado: {point.latitude.toFixed(5)},{" "}
              {point.longitude.toFixed(5)}
            </p>
          )}

          {error && <FieldError>{error}</FieldError>}
        </FieldGroup>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="button" disabled={busy} onClick={submit}>
            {busy && <Spinner />}
            {uploading ? "Enviando foto…" : "Cadastrar cliente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
