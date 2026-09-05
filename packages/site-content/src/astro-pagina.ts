import { z } from "zod";

/**
 * O que o Astro sabe de uma página do site.
 *
 * É cadastrado no admin, página por página, e serve a três momentos
 * diferentes — daí os três campos, e não um texto só:
 *
 * - os **balões** são o que ele fala sozinho quando alguém chega. São falas
 *   escritas por gente, nunca geradas: elas aparecem em toda visita, e pagar
 *   um modelo para inventar "essa é top hein" a cada carregamento de página
 *   seria caro e pior;
 * - as **palavras-chave** entram no prompt quando a conversa começa ali. São
 *   o vocabulário daquela página, o que faz o Astro puxar o assunto certo;
 * - o **resumo** é o que ele diz se perguntarem "o que é isto aqui?" sem
 *   precisar de nenhuma tool.
 */

export const astroPaginaSchema = z.object({
  /** Sem isto ele passa em silêncio por esta página. */
  ativo: z.boolean().default(true),
  /**
   * O que ele solta ao visitante chegar, na ordem. Duas ou três: a quarta
   * fala de um mascote que ninguém chamou vira barulho.
   */
  baloes: z.array(z.string().max(140)).max(4).default([]),
  /** O vocabulário da página, para o Astro puxar o assunto certo. */
  palavrasChave: z.array(z.string().max(40)).max(12).default([]),
  /** Duas ou três linhas sobre a página, na voz da casa. */
  resumo: z.string().max(600).default(""),
});

export type AstroPagina = z.infer<typeof astroPaginaSchema>;

export const ASTRO_PAGINA_VAZIA: AstroPagina = astroPaginaSchema.parse({});

/**
 * Lê a configuração de um valor cru do banco.
 *
 * Fora de formato vira a configuração vazia em vez de erro: uma fala do
 * mascote mal salva não pode derrubar a página que ela acompanha.
 */
export function lerAstroPagina(valor: unknown): AstroPagina {
  const resultado = astroPaginaSchema.safeParse(valor);
  return resultado.success ? resultado.data : ASTRO_PAGINA_VAZIA;
}

/** Há algo para o Astro dizer nesta página? */
export function astroTemFala(config: AstroPagina): boolean {
  return config.ativo && config.baloes.some((fala) => fala.trim().length > 0);
}
