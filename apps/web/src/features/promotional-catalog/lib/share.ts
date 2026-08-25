// Utilidades de compartilhamento da imagem do catálogo.
//
// Realidade da web: não existe "postar no Instagram" via link, e o WhatsApp Web
// só aceita texto/URL — a imagem só vai pela bandeja nativa do sistema (Web
// Share API com arquivo), disponível sobretudo no celular. No desktop o melhor
// é baixar a imagem (e, no caso do WhatsApp, abrir o wa.me com o texto).

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(",");
  const mime = /data:(.*?);base64/.exec(head)?.[1] ?? "image/png";
  const binary = atob(body ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

export type ShareResult = "shared" | "downloaded";

type NavShare = Navigator & { canShare?: (data: ShareData) => boolean };

// Tenta compartilhar a imagem pela bandeja nativa (celular). Se não der, baixa.
export async function shareImageFile(opts: {
  dataUrl: string;
  filename: string;
  text?: string;
}): Promise<ShareResult> {
  const { dataUrl, filename, text } = opts;
  try {
    const blob = dataUrlToBlob(dataUrl);
    const file = new File([blob], filename, {
      type: blob.type || "image/png",
    });
    const nav = navigator as NavShare;
    if (nav.share && nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], text });
      return "shared";
    }
  } catch {
    // usuário cancelou a bandeja OU não suportado — cai no download
  }
  downloadDataUrl(dataUrl, filename);
  return "downloaded";
}

export function openWhatsAppText(text: string) {
  window.open(
    `https://wa.me/?text=${encodeURIComponent(text)}`,
    "_blank",
    "noopener,noreferrer",
  );
}

// Copia a imagem para a área de transferência (quando o navegador suporta).
export async function copyImageToClipboard(dataUrl: string): Promise<boolean> {
  try {
    const blob = dataUrlToBlob(dataUrl);
    const ClipboardItemCtor = (
      window as unknown as { ClipboardItem?: typeof ClipboardItem }
    ).ClipboardItem;
    if (!navigator.clipboard || !ClipboardItemCtor) return false;
    await navigator.clipboard.write([
      new ClipboardItemCtor({ [blob.type || "image/png"]: blob }),
    ]);
    return true;
  } catch {
    return false;
  }
}
