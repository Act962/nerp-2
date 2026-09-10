import "server-only";

import { generateImage } from "ai";
import { v4 as uuidv4 } from "uuid";
import type { ModeloResolvido } from "@/features/astro-consultor/server/provider";
import { constructUrl } from "@/hooks/use-construct-url";
import { uploadBufferToR2 } from "@/lib/upload-buffer-to-r2";

/**
 * Gerar imagem e guardar no bucket da organização.
 *
 * Separado da tool de propósito: é a única parte que fala com o provedor, e é
 * o que o teste dubla. A imagem nasce dentro do prefixo da organização
 * (`<orgId>/astro/`), o mesmo que a rota de upload usa — é o prefixo que
 * decide, depois, quem pode apagar e o que pode ser anexado numa conversa.
 */

/** O modelo de imagem do Google. Nenhum outro provedor entra aqui. */
export const MODELO_DE_IMAGEM = "gemini-2.5-flash-image";

/** Quantas imagens uma organização gera por dia. */
export const COTA_DIARIA_DE_IMAGENS = 20;

const EXTENSAO: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export type ImagemGerada = {
  chave: string;
  url: string;
  mediaType: string;
};

export async function gerarEGuardarImagem(entrada: {
  organizationId: string;
  modelo: ModeloResolvido;
  descricao: string;
  proporcao?: "1:1" | "4:5" | "16:9" | "9:16";
}): Promise<ImagemGerada> {
  const google = entrada.modelo.google;
  if (!google) {
    throw new Error(
      "A geração de imagem só existe no provedor Google, e não é ele que está atendendo agora.",
    );
  }

  const resultado = await generateImage({
    model: google.image(MODELO_DE_IMAGEM),
    prompt: entrada.descricao,
    ...(entrada.proporcao ? { aspectRatio: entrada.proporcao } : {}),
  });

  const imagem = resultado.image;
  const mediaType = imagem.mediaType || "image/png";
  const extensao = EXTENSAO[mediaType] ?? "png";
  const chave = `${entrada.organizationId}/astro/${uuidv4()}.${extensao}`;

  await uploadBufferToR2(chave, Buffer.from(imagem.uint8Array), mediaType);

  return { chave, url: constructUrl(chave), mediaType };
}
