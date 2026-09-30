import "server-only";

import { generateImage } from "ai";
import { v4 as uuidv4 } from "uuid";
import {
  type ModeloResolvido,
  googleDisponivel,
  openaiDisponivel,
} from "@/features/astro-consultor/server/provider";
import { constructUrl } from "@/hooks/use-construct-url";
import { uploadBufferToR2 } from "@/lib/upload-buffer-to-r2";
import type { ModeloDeImagem, QualidadeDeImagem } from "./modelos";

/**
 * Gerar imagem e guardar no bucket da organização.
 *
 * Separado da tool de propósito: é a única parte que fala com o provedor, e é
 * o que o teste dubla. A imagem nasce dentro do prefixo da organização
 * (`<orgId>/astro/`), o mesmo que a rota de upload usa — é o prefixo que
 * decide, depois, quem pode apagar e o que pode ser anexado numa conversa.
 */

/** O modelo de imagem do Google. */
export const MODELO_DE_IMAGEM = "gemini-2.5-flash-image";

/**
 * O de imagem da OpenAI, quando é ela quem atende. O Astro usa o `mini` em
 * qualidade média: é arte de apoio, e o preço fica perto do Google.
 */
export const MODELO_DE_IMAGEM_OPENAI: ModeloDeImagem = "gpt-image-1-mini";

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

type Proporcao = "1:1" | "4:5" | "16:9" | "9:16" | "3:2";

// A OpenAI só aceita três tamanhos; cada proporção cai no mais próximo.
const TAMANHO_OPENAI: Record<Proporcao, `${number}x${number}`> = {
  "1:1": "1024x1024",
  "4:5": "1024x1536",
  "9:16": "1024x1536",
  "16:9": "1536x1024",
  "3:2": "1536x1024",
};

async function guardar(
  organizationId: string,
  pasta: string,
  bytes: Uint8Array,
  mediaTypeBruto: string | undefined,
): Promise<ImagemGerada> {
  const mediaType = mediaTypeBruto || "image/png";
  const extensao = EXTENSAO[mediaType] ?? "png";
  const chave = `${organizationId}/${pasta}/${uuidv4()}.${extensao}`;
  await uploadBufferToR2(chave, Buffer.from(bytes), mediaType);
  return { chave, url: constructUrl(chave), mediaType };
}

// O Gemini aceita proporção, não tamanho. "4:5" aqui é o retrato 2:3 da
// OpenAI (1024×1536) — as zonas da arte da oferta contam com 2:3.
const PROPORCAO_GOOGLE: Record<Proporcao, string> = {
  "1:1": "1:1",
  "4:5": "2:3",
  "9:16": "9:16",
  "16:9": "16:9",
  "3:2": "3:2",
};

/**
 * Imagem pela OpenAI e, se ela não estiver disponível ou falhar, pelo Gemini.
 * O Gemini não recorta fundo: um logo pedido transparente sai com fundo.
 * A cobrança não muda com o provedor — quem chama cobra pelo nível.
 */
export async function gerarImagemComFallback(
  entrada: Parameters<typeof gerarImagemOpenAI>[0],
): Promise<ImagemGerada & { provedor: "openai" | "google" }> {
  let falhaOpenAi: unknown = null;
  if (openaiDisponivel()) {
    try {
      return { ...(await gerarImagemOpenAI(entrada)), provedor: "openai" };
    } catch (falha) {
      falhaOpenAi = falha;
      console.warn("[imagem] OpenAI falhou, tentando o Gemini", falha);
    }
  }
  const google = googleDisponivel();
  if (!google) {
    throw falhaOpenAi instanceof Error
      ? falhaOpenAi
      : new Error("Nenhum provedor de imagem configurado.");
  }
  const resultado = await generateImage({
    model: google.image(MODELO_DE_IMAGEM),
    prompt: entrada.descricao,
    aspectRatio: PROPORCAO_GOOGLE[
      entrada.proporcao ?? "1:1"
    ] as `${number}:${number}`,
  });
  return {
    ...(await guardar(
      entrada.organizationId,
      entrada.pasta,
      resultado.image.uint8Array,
      resultado.image.mediaType,
    )),
    provedor: "google",
  };
}

/**
 * Imagem pela OpenAI, fora de qualquer conversa (o logo da oferta usa
 * direto). `transparente` pede PNG com fundo recortado — é o que deixa o logo
 * pousar sobre qualquer fundo de página.
 */
export async function gerarImagemOpenAI(entrada: {
  organizationId: string;
  descricao: string;
  modelo: ModeloDeImagem;
  qualidade: QualidadeDeImagem;
  proporcao?: Proporcao;
  transparente?: boolean;
  pasta: string;
}): Promise<ImagemGerada> {
  const openai = openaiDisponivel();
  if (!openai)
    throw new Error("A geração de imagem precisa da chave da OpenAI.");
  const resultado = await generateImage({
    model: openai.image(entrada.modelo),
    prompt: entrada.descricao,
    size: TAMANHO_OPENAI[entrada.proporcao ?? "1:1"],
    providerOptions: {
      openai: {
        quality: entrada.qualidade,
        ...(entrada.transparente
          ? { background: "transparent", outputFormat: "png" }
          : {}),
      },
    },
  });
  return guardar(
    entrada.organizationId,
    entrada.pasta,
    resultado.image.uint8Array,
    resultado.image.mediaType,
  );
}

export async function gerarEGuardarImagem(entrada: {
  organizationId: string;
  modelo: ModeloResolvido;
  descricao: string;
  proporcao?: "1:1" | "4:5" | "16:9" | "9:16";
}): Promise<ImagemGerada> {
  const google = entrada.modelo.google;
  if (!google) {
    if (entrada.modelo.provedor === "openai") {
      return gerarImagemComFallback({
        organizationId: entrada.organizationId,
        descricao: entrada.descricao,
        modelo: MODELO_DE_IMAGEM_OPENAI,
        qualidade: "medium",
        proporcao: entrada.proporcao,
        pasta: "astro",
      });
    }
    throw new Error("Nenhum provedor de imagem configurado.");
  }

  const resultado = await generateImage({
    model: google.image(MODELO_DE_IMAGEM),
    prompt: entrada.descricao,
    ...(entrada.proporcao ? { aspectRatio: entrada.proporcao } : {}),
  });

  return guardar(
    entrada.organizationId,
    "astro",
    resultado.image.uint8Array,
    resultado.image.mediaType,
  );
}
