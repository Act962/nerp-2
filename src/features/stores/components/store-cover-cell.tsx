"use client";

import { Spinner } from "@/components/ui/spinner";
import { constructUrl } from "@/hooks/use-construct-url";
import { uploadToR2 } from "@/lib/upload-to-r2";
import { ImageIcon, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useUpdateStore } from "../hooks/use-stores";

// Miniatura clicável da fachada da loja (vitrine pública). Mostra a foto atual
// ou um placeholder; clicar abre o seletor, envia ao R2 (fluxo presignado) e
// grava a chave em coverImageKey — sem precisar abrir a edição da loja.
export function StoreCoverCell({
  storeId,
  coverImageKey,
  name,
}: {
  storeId: string;
  coverImageKey: string | null;
  name: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const updateStore = useUpdateStore();
  const busy = uploading || updateStore.isPending;

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // permite re-selecionar o mesmo arquivo
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem");
      return;
    }
    setUploading(true);
    try {
      const key = await uploadToR2(file);
      updateStore.mutate({ id: storeId, coverImageKey: key });
    } catch {
      toast.error("Falha ao enviar a imagem");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFile}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        title="Enviar foto da fachada"
        className="group relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted disabled:opacity-60"
      >
        {busy ? (
          <Spinner />
        ) : coverImageKey ? (
          // biome-ignore lint/performance/noImgElement: foto por key do R2
          <img
            src={constructUrl(coverImageKey)}
            alt={name}
            className="size-full object-cover"
          />
        ) : (
          <ImageIcon className="size-5 text-muted-foreground" />
        )}
        {!busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition group-hover:opacity-100">
            <Upload className="size-4 text-white" />
          </span>
        )}
      </button>
    </>
  );
}
