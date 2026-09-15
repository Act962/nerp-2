import { constructUrl } from "@/hooks/use-construct-url";

/**
 * Sobe uma imagem para o bucket da organização e devolve a URL pública.
 *
 * O caminho é o de sempre — assinatura em `/api/s3/upload`, PUT direto no R2.
 * O prefixo da organização é posto pelo SERVIDOR, nunca daqui: é ele que prova
 * de quem é o objeto, e é contra ele que o servidor confere a imagem quando
 * ela volta num pedido de melhoria.
 *
 * Devolve `null` em qualquer falha, para quem chama decidir o que dizer.
 */
export async function subirImagem(
  arquivo: File,
  pasta: string,
): Promise<string | null> {
  try {
    const assinatura = await fetch("/api/s3/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: arquivo.name,
        contentType: arquivo.type,
        size: arquivo.size,
        isImage: true,
        pasta,
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

    return constructUrl(key) || null;
  } catch {
    return null;
  }
}
