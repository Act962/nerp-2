/**
 * Baixar e compartilhar as fotos aprovadas.
 *
 * Tudo passa pelo proxy `/api/s3/image` (mesma origem) e não pela URL pública
 * do R2. Não é preferência: o atributo `download` de um `<a>` é IGNORADO em
 * link de outra origem — o navegador abre a imagem em vez de salvar. Buscando
 * como blob de mesma origem, o download acontece de fato.
 */

function proxyUrl(key: string): string {
  if (key.startsWith("http://") || key.startsWith("https://")) return key;
  return `/api/s3/image?key=${encodeURIComponent(key)}`;
}

function safeName(parts: (string | null | undefined)[]): string {
  const base = parts
    .filter(Boolean)
    .join("-")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "foto"}.jpg`;
}

export interface PhotoRef {
  photoKey: string;
  storeName: string;
  supplierName: string | null;
  capturedAt: string;
}

export function photoFileName(photo: PhotoRef): string {
  const date = photo.capturedAt.slice(0, 10);
  return safeName([photo.storeName, photo.supplierName, date]);
}

async function fetchPhotoFile(photo: PhotoRef): Promise<File> {
  const response = await fetch(proxyUrl(photo.photoKey));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const blob = await response.blob();
  return new File([blob], photoFileName(photo), {
    type: blob.type || "image/jpeg",
  });
}

function saveBlob(file: File) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Só revoga depois do clique ser processado; revogar na hora cancela o
  // download em alguns navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Baixa cada foto como arquivo próprio — sem zip, como pedido.
 *
 * Um download por vez, em série. Vários downloads seguidos disparam a
 * permissão "baixar vários arquivos" do navegador; o intervalo evita que os
 * cliques sejam agrupados e descartados. Retorna quantas falharam.
 */
export async function downloadPhotos(photos: PhotoRef[]): Promise<number> {
  let failed = 0;
  for (const photo of photos) {
    try {
      saveBlob(await fetchPhotoFile(photo));
      await new Promise((resolve) => setTimeout(resolve, 350));
    } catch {
      failed++;
    }
  }
  return failed;
}

export type ShareOutcome = "shared" | "link" | "unsupported" | "cancelled";

/**
 * Compartilha as fotos. No celular abre a bandeja do sistema com o arquivo em
 * anexo (WhatsApp entre as opções) — é o único caminho: o `wa.me` só carrega
 * texto, nunca imagem. Sem suporte a arquivos, cai para o `wa.me` com o link
 * público da foto, que o WhatsApp expande em prévia.
 */
export async function sharePhotosToWhatsapp(
  photos: PhotoRef[],
  publicUrl: (key: string) => string,
): Promise<ShareOutcome> {
  const label =
    photos.length === 1
      ? `Foto em ${photos[0].storeName}`
      : `${photos.length} fotos`;

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      const files = await Promise.all(photos.map(fetchPhotoFile));
      if (navigator.canShare?.({ files })) {
        await navigator.share({ files, title: label, text: label });
        return "shared";
      }
    } catch (error) {
      // O usuário fechar a bandeja vem como AbortError — não é falha.
      if (error instanceof DOMException && error.name === "AbortError") {
        return "cancelled";
      }
    }
  }

  if (photos.length === 1) {
    const text = `${label}: ${publicUrl(photos[0].photoKey)}`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer",
    );
    return "link";
  }

  return "unsupported";
}
