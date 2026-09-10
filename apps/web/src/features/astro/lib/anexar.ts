import type { FileUIPart } from "ai";
import { constructUrl } from "@/hooks/use-construct-url";

/**
 * Subir uma imagem da conversa para o bucket da organização.
 *
 * O caminho é o mesmo de qualquer upload do sistema — assinatura em
 * `/api/s3/upload`, PUT direto no R2 —, com a subpasta `astro`. O prefixo da
 * organização é posto pelo servidor, nunca por aqui: é ele que faz o anexo ser
 * aceito depois, e ele é a prova de posse do objeto.
 *
 * Devolve `null` em qualquer falha: quem chama mostra o aviso, e uma conversa
 * não deve morrer porque uma foto não subiu.
 */
export async function subirAnexoDoAstro(
  arquivo: File,
): Promise<FileUIPart | null> {
  try {
    const assinatura = await fetch("/api/s3/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: arquivo.name,
        contentType: arquivo.type,
        size: arquivo.size,
        isImage: true,
        pasta: "astro",
      }),
    });
    if (!assinatura.ok) return null;

    const { presignedUrl, key } = (await assinatura.json()) as {
      presignedUrl?: string;
      key?: string;
    };
    if (!presignedUrl || !key) return null;

    const envio = await fetch(presignedUrl, {
      method: "PUT",
      headers: { "Content-Type": arquivo.type },
      body: arquivo,
    });
    if (!envio.ok) return null;

    const url = constructUrl(key);
    if (!url) return null;

    return {
      type: "file",
      mediaType: arquivo.type,
      url,
      filename: arquivo.name,
    };
  } catch {
    return null;
  }
}
