import { z } from "zod";

/**
 * Os recursos de conversão do site: o aviso de saída, a barra fixa e o Astro
 * que abre sozinho. Vêm do Órbita Pages, sem o que lá é prova social
 * inventada (nomes sorteados "acabando de comprar", visitantes aleatórios).
 *
 * Tudo começa desligado: um site sem ninguém ter configurado nada não ganha
 * popup por atualização de código.
 */

/** Para onde o botão leva. `astro` e `whatsapp` dispensam link. */
export const ACOES_DE_CONVERSAO = ["astro", "whatsapp", "link"] as const;
export type AcaoDeConversao = (typeof ACOES_DE_CONVERSAO)[number];

/**
 * Só caminho interno ou https. `javascript:` num botão de todas as páginas é
 * o mesmo risco do pixel com texto livre.
 */
export const LINK_DE_CONVERSAO_RE = /^(\/(?!\/)[^\s]*|https:\/\/[^\s]+)$/;

const texto = (max: number, padrao: string) =>
  z.string().trim().max(max).default(padrao);

const link = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => v === "" || LINK_DE_CONVERSAO_RE.test(v),
    "Use um caminho do site (/solucoes) ou um endereço https://",
  )
  .default("");

export const siteConversaoSchema = z.object({
  saida: z
    .object({
      ativo: z.boolean().default(false),
      titulo: texto(80, "Antes de ir…"),
      texto: texto(
        300,
        "Conte o que trava a sua operação e o Astro monta um diagnóstico em poucos minutos.",
      ),
      /** Opcional: aparece com botão de copiar. */
      cupom: texto(40, ""),
      botao: texto(40, "Falar com o Astro"),
      acao: z.enum(ACOES_DE_CONVERSAO).default("astro"),
      link,
      /** Desligado: volta a aparecer numa visita futura. */
      umaVezPorVisitante: z.boolean().default(true),
    })
    .prefault({}),
  barra: z
    .object({
      ativo: z.boolean().default(false),
      texto: texto(120, "Descubra quanto a sua operação pode render."),
      botao: texto(40, "Agendar demonstração"),
      acao: z.enum(ACOES_DE_CONVERSAO).default("whatsapp"),
      link,
      /** Quanto da página rolar antes de ela aparecer (%). */
      aposRolar: z.number().int().min(0).max(90).default(25),
    })
    .prefault({}),
  astro: z
    .object({
      autoAbrir: z.boolean().default(false),
      aposSegundos: z.number().int().min(3).max(120).default(12),
      /** No celular o painel ocupa a tela inteira: desligado por padrão. */
      noCelular: z.boolean().default(false),
    })
    .prefault({}),
});

export type SiteConversao = z.infer<typeof siteConversaoSchema>;

export const CONVERSAO_PADRAO: SiteConversao = siteConversaoSchema.parse({});

/** Fora do formato vira o padrão — que é tudo desligado. */
export function lerConversao(valor: unknown): SiteConversao {
  const lido = siteConversaoSchema.safeParse(valor ?? {});
  return lido.success ? lido.data : CONVERSAO_PADRAO;
}
