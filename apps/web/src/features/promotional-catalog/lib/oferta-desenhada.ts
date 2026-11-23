import { z } from "zod";
import {
  CLIMAS_OFERTA,
  type ClimaOferta,
  type EntradaOferta,
} from "./compor-oferta";

// A parte da IA no gerador de oferta, sem IA dentro: os níveis, o que o modelo
// pode devolver (`ofertaDesenhadaSchema`) e como isso vira parâmetro do
// compositor (`aplicarDesenho`). Módulo neutro — o assistente mostra os níveis
// e a estimativa com os mesmos números que o servidor cobra.

export type NivelOferta = "ECONOMICO" | "EQUILIBRADO" | "PREMIUM";

export const NIVEIS_OFERTA: {
  value: NivelOferta;
  label: string;
  detalhe: string;
  /** Id em `astro/server/modelos.ts` — a tabela de preços é a mesma do Astro. */
  modelo: string;
}[] = [
  {
    value: "ECONOMICO",
    label: "Econômico",
    detalhe: "Rápido e barato",
    modelo: "gpt-4.1-nano",
  },
  {
    value: "EQUILIBRADO",
    label: "Equilibrado",
    detalhe: "O melhor custo-benefício",
    modelo: "gpt-4.1-mini",
  },
  {
    value: "PREMIUM",
    label: "Premium",
    detalhe: "Chamadas mais caprichadas",
    modelo: "gpt-4.1",
  },
];

/** O logo por nível: o `mini` até o Equilibrado, o cheio só no Premium. */
export const IMAGEM_DO_NIVEL: Record<
  NivelOferta,
  {
    modelo: "gpt-image-1-mini" | "gpt-image-1";
    qualidade: "low" | "medium" | "high";
  }
> = {
  ECONOMICO: { modelo: "gpt-image-1-mini", qualidade: "low" },
  EQUILIBRADO: { modelo: "gpt-image-1-mini", qualidade: "medium" },
  PREMIUM: { modelo: "gpt-image-1", qualidade: "high" },
};

/**
 * A ARTE da página por nível. A arte é o que o cliente vê primeiro, então só
 * o Econômico desce para o `mini`; o Premium usa qualidade alta (~1 min).
 */
export const ARTE_DO_NIVEL: Record<
  NivelOferta,
  {
    modelo: "gpt-image-1-mini" | "gpt-image-1";
    qualidade: "low" | "medium" | "high";
  }
> = {
  ECONOMICO: { modelo: "gpt-image-1-mini", qualidade: "medium" },
  EQUILIBRADO: { modelo: "gpt-image-1", qualidade: "medium" },
  PREMIUM: { modelo: "gpt-image-1", qualidade: "high" },
};

/**
 * O fallback de texto no Gemini, por nível: mesmo porte do modelo OpenAI.
 * Ids da tabela de preços do Astro (`astro/server/modelos.ts`).
 */
export const FALLBACK_GEMINI_DO_NIVEL: Record<NivelOferta, string> = {
  ECONOMICO: "gemini-2.5-flash-lite",
  EQUILIBRADO: "gemini-3.5-flash",
  PREMIUM: "gemini-3.1-pro",
};

export function modeloDoNivelDeOferta(nivel: NivelOferta): string {
  return NIVEIS_OFERTA.find((n) => n.value === nivel)?.modelo ?? "gpt-4.1-mini";
}

/**
 * Tokens de uma geração, para ESTIMAR antes de cobrar. O prompt tem uma parte
 * fixa (instruções + climas) e uma linha por produto; a saída é o JSON curto
 * do desenho. Folgado para cima: a cobrança real é pelo `usage` do provedor.
 */
export function tokensEstimados(produtos: number): {
  tokensIn: number;
  tokensOut: number;
} {
  return { tokensIn: 800 + 50 * produtos, tokensOut: 120 + 15 * produtos };
}

const climas = CLIMAS_OFERTA.map((c) => c.value) as [
  ClimaOferta,
  ...ClimaOferta[],
];

export const climaOfertaSchema = z.enum(climas);

/** O que o modelo devolve. Vocabulário fechado: ele escolhe, não desenha. */
export const ofertaDesenhadaSchema = z.object({
  molde: z
    .enum(["grade", "destaque"])
    .describe(
      "grade = todos do mesmo tamanho; destaque = o 1º da ordem em grande",
    ),
  clima: z.enum(climas).describe("Estilo visual da página"),
  corBase: z
    .string()
    .describe("Cor principal em hexadecimal de 6 dígitos, ex.: #d50000"),
  chamada: z
    .string()
    .describe("Frase curta de impacto abaixo do nome da oferta, até 50 letras"),
  ordem: z
    .array(z.string())
    .describe(
      "Ids dos produtos na ordem de exibição; o mais atrativo primeiro",
    ),
});

export type OfertaDesenhada = z.infer<typeof ofertaDesenhadaSchema>;

/** O pedido de geração: a entrada do assistente + o que a IA pode mudar. */
export const pedidoDeOfertaSchema = z.object({
  formato: z.enum(["a4", "story", "feed"]),
  produtoIds: z.array(z.string()).min(1).max(60),
  precosPor: z.record(z.string(), z.number()).optional(),
  oferta: z.object({
    nome: z.string().min(1).max(80),
    chamada: z.string().max(120).optional(),
    validade: z.string().max(20).optional(),
    informacoes: z.array(z.string().max(120)).max(10).optional(),
    contato: z.string().max(120).optional(),
  }),
  logo: z
    .union([
      z.object({ tipo: z.literal("asset"), chave: z.string().min(1) }),
      z.object({ tipo: z.literal("org") }),
    ])
    .nullable()
    .optional(),
  clima: z.enum(climas),
  corBase: z.string().optional(),
  molde: z.enum(["grade", "destaque"]),
  proporcaoCard: z.number().positive().optional(),
  /** Pede a arte premium desenhada pela IA (molde "arte + dados por cima"). */
  arteIa: z.boolean().optional(),
  /** Etiqueta de preço salva (`PromotionalPriceStyle`) — a da org ou do sistema. */
  etiquetaId: z.string().optional(),
});

export type PedidoDeOferta = z.infer<typeof pedidoDeOfertaSchema>;

const HEX6 = /^#[0-9a-f]{6}$/i;

/**
 * Junta o desenho da IA com o que o usuário escolheu.
 *
 * - `estiloLivre`: o usuário deixou a IA escolher clima e cor. Senão ficam os
 *   dele — a IA só escolhe disposição, chamada e ordem.
 * - Chamada digitada pelo usuário nunca é trocada.
 * - A ordem só pode REORDENAR: id que não estava no pedido é descartado e o
 *   que a IA esqueceu vai para o fim. Nenhum produto entra ou some por ela.
 * - Cor fora do formato cai na do usuário (e, sem ela, no padrão do clima).
 */
export function aplicarDesenho(
  pedido: PedidoDeOferta,
  desenho: OfertaDesenhada,
  estiloLivre: boolean,
): EntradaOferta {
  const pedidos = new Set(pedido.produtoIds);
  const vistos = new Set<string>();
  const ordem = desenho.ordem.filter((id) => {
    if (!pedidos.has(id) || vistos.has(id)) return false;
    vistos.add(id);
    return true;
  });
  for (const id of pedido.produtoIds) if (!vistos.has(id)) ordem.push(id);

  const chamadaDaIa = desenho.chamada.trim().slice(0, 60);
  const cor =
    estiloLivre && HEX6.test(desenho.corBase)
      ? desenho.corBase
      : pedido.corBase;

  return {
    ...pedido,
    produtoIds: ordem,
    molde: desenho.molde,
    clima: estiloLivre ? desenho.clima : pedido.clima,
    corBase: cor,
    oferta: {
      ...pedido.oferta,
      chamada: pedido.oferta.chamada?.trim() || chamadaDaIa || undefined,
    },
  };
}
