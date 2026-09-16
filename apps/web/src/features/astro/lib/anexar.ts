import type { FileUIPart } from "ai";
import { subirImagem } from "@/features/jornadas/lib/subir-imagem";

/**
 * Subir uma imagem da conversa para o bucket da organização.
 *
 * O envio em si é o `subirImagem` comum a todo upload do sistema; o que é do
 * Astro é a subpasta (`astro`, que o servidor confere ao aceitar o anexo) e o
 * formato de saída, que é o `FileUIPart` da conversa.
 *
 * Devolve `null` em qualquer falha: quem chama mostra o aviso, e uma conversa
 * não deve morrer porque uma foto não subiu.
 */
export async function subirAnexoDoAstro(
  arquivo: File,
): Promise<FileUIPart | null> {
  const url = await subirImagem(arquivo, "astro");
  if (!url) return null;

  return {
    type: "file",
    mediaType: arquivo.type,
    url,
    filename: arquivo.name,
  };
}
