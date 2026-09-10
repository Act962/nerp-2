import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { z } from "zod";

/**
 * Que modelo atende o consultor.
 *
 * Gemini Flash por padrão. Três motivos, nesta ordem: é a chave que já existe
 * no ambiente (`GOOGLE_GENERATIVE_AI_API_KEY`), chat de site é volume alto com
 * latência sensível, e é o mesmo modelo do chat público do Órbita — o prompt e
 * as tools portam sem re-ajuste. OpenAI entra por env quando se quiser trocar.
 *
 * Sem chave nenhuma, `resolverModelo` devolve `null` e a rota responde 503. O
 * site não pode cair porque uma chave de IA venceu — é o mesmo desligamento
 * gracioso de `shopper/server/identify-product-vision.ts`.
 */

export const ASTRO_CONFIG_KEY = "astro-config";

export const astroConfigSchema = z.object({
  /** Botão de desligar sem deploy. */
  ativo: z.boolean().default(true),
  /**
   * Teto de mensagens por dia no site inteiro. 0 = sem teto. É a trava que
   * protege a fatura quando as travas por visitante não seguram.
   */
  tetoMensagensDia: z.number().int().min(0).default(0),
  /** Sobrepõe o modelo padrão. Vazio = o que o ambiente decidir. */
  modelo: z.string().default(""),
  /**
   * Fechar a conversa longa com um resumo curto guardado na memória da
   * organização. **Desligado por padrão**: é o único uso de IA fora da
   * conversa, e uma chamada a mais por conversa longa em toda a base é conta
   * que ninguém pediu. Quem quiser, liga.
   */
  resumirConversas: z.boolean().default(false),
});

export type AstroConfig = z.infer<typeof astroConfigSchema>;

export const ASTRO_CONFIG_PADRAO: AstroConfig = astroConfigSchema.parse({});

export function lerConfig(valor: unknown): AstroConfig {
  const resultado = astroConfigSchema.safeParse(valor);
  return resultado.success ? resultado.data : ASTRO_CONFIG_PADRAO;
}

const MODELO_GOOGLE_PADRAO = "gemini-2.5-flash";
const MODELO_OPENAI_PADRAO = "gpt-4o-mini";

export type ModeloResolvido = {
  modelo: LanguageModel;
  /** Para gravar na sessão e saber depois o que respondeu o quê. */
  nome: string;
  /**
   * Quem está atendendo. Busca na web e geração de imagem são tools do
   * PROVEDOR, não do SDK: existem no Google e não na OpenAI, então quem monta
   * o conjunto de tools precisa saber com quem está falando.
   */
  provedor: "google" | "openai";
  /** O provedor Google já construído, para `google.image` e `google.tools`. */
  google?: ReturnType<typeof createGoogleGenerativeAI>;
};

/**
 * O modelo, ou `null` quando não há chave. Nunca lança: quem chama decide o
 * que fazer sem IA, e a resposta é sempre um site de pé.
 */
export function resolverModelo(
  preferido?: string | null,
): ModeloResolvido | null {
  const escolhido = preferido?.trim() || process.env.ASTRO_CONSULTOR_MODEL;

  const chaveGoogle = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const chaveOpenAi = process.env.OPENAI_API_KEY;

  // Um nome que começa com "gpt-" só pode ser OpenAI; o resto assume Google.
  const querOpenAi = escolhido?.startsWith("gpt-") ?? false;

  if (querOpenAi && chaveOpenAi) {
    const openai = createOpenAI({ apiKey: chaveOpenAi });
    const nome = escolhido ?? MODELO_OPENAI_PADRAO;
    return { modelo: openai(nome), nome, provedor: "openai" };
  }

  if (chaveGoogle) {
    const google = createGoogleGenerativeAI({ apiKey: chaveGoogle });
    const nome = querOpenAi
      ? MODELO_GOOGLE_PADRAO
      : (escolhido ?? MODELO_GOOGLE_PADRAO);
    return { modelo: google(nome), nome, provedor: "google", google };
  }

  if (chaveOpenAi) {
    const openai = createOpenAI({ apiKey: chaveOpenAi });
    const nome = escolhido?.startsWith("gpt-")
      ? escolhido
      : MODELO_OPENAI_PADRAO;
    return { modelo: openai(nome), nome, provedor: "openai" };
  }

  return null;
}
