/**
 * Sobe uma imagem para o R2 pela URL assinada e devolve a chave.
 *
 * O mesmo caminho do uploader do carrossel, sem a zona de arrastar: na lista
 * de categorias cada linha tem só um botão, e a zona inteira não caberia.
 */
export async function enviarImagem(arquivo: File): Promise<string> {
  const assinatura = await fetch("/api/s3/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: arquivo.name,
      contentType: arquivo.type,
      size: arquivo.size,
      isImage: true,
    }),
  });
  if (!assinatura.ok) throw new Error("Não foi possível preparar o envio.");

  const { presignedUrl, key } = (await assinatura.json()) as {
    presignedUrl: string;
    key: string;
  };

  const envio = await fetch(presignedUrl, {
    method: "PUT",
    headers: { "Content-Type": arquivo.type },
    body: arquivo,
  });
  if (!envio.ok) throw new Error("Falha ao enviar a imagem.");

  return key;
}
