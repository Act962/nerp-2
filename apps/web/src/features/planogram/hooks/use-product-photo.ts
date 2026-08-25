"use client";

import { compressImage } from "@/lib/compress-image";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/** Converte o arquivo em base64 puro, sem o prefixo `data:...;base64,`. */
async function toBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const CHUNK = 0x8000; // fatiado: apply com array gigante estoura a pilha
  for (let offset = 0; offset < bytes.length; offset += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK));
  }
  return btoa(binary);
}

export function useNormalizeProductPhoto() {
  const queryClient = useQueryClient();

  const mutation = useMutation(
    orpc.planogram.normalizeProductPhoto.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["planogram"] });
      },
    }),
  );

  async function upload(productId: string, file: File) {
    // Reduz antes de enviar: mantém o recorte no servidor em ~200ms e o
    // payload em algumas centenas de KB.
    const compressed = await compressImage(file, { maxEdge: 1400 });
    const imageBase64 = await toBase64(compressed);
    return mutation.mutateAsync({ productId, imageBase64 });
  }

  return { upload, isPending: mutation.isPending };
}

/** Recorta a foto que já está no cadastro, sem passar por upload. */
export function useRecutProductPhoto() {
  const queryClient = useQueryClient();

  const mutation = useMutation(
    orpc.planogram.recutProductPhoto.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["planogram"] });
      },
    }),
  );

  return { recut: mutation.mutateAsync, isPending: mutation.isPending };
}
