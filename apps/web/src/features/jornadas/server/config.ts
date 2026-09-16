import { z } from "zod";
import type { Jornada } from "../catalogo/tipos";

/**
 * Quanto vale cada jornada e quais estão no ar.
 *
 * Chave/valor em `SiteSetting`, como as faixas do Astro: são poucos números,
 * mudam sozinhos e quem mexe neles é o dono da plataforma — tabela própria
 * cobraria uma migration a cada ajuste de preço.
 *
 * A chave é o `id` da jornada. Jornada sem linha aqui vale o `starsSugeridas`
 * do catálogo e nasce ativa: uma jornada nova precisa funcionar no deploy, sem
 * alguém lembrar de ir ao admin ligá-la.
 */

export const JORNADAS_CONFIG_KEY = "jornadas";

/** Teto por jornada. É uma trava de dedo escorregado, não uma regra de negócio. */
export const MAXIMO_DE_ESTRELAS = 1000;

export const jornadaConfigSchema = z.object({
  stars: z.number().min(0).max(MAXIMO_DE_ESTRELAS),
  ativa: z.boolean(),
});

export const jornadasConfigSchema = z.object({
  porJornada: z.record(z.string(), jornadaConfigSchema).default({}),
  /**
   * Empresa de teste também ganha ★.
   *
   * Liga por padrão porque quem está de teste é exatamente quem precisa
   * aprender o sistema — e porque as ★ da sandbox só se gastam dentro dela.
   * Fica desligável para o caso de alguém descobrir que criar empresa nova sai
   * mais barato que recarregar.
   */
  recompensarSandbox: z.boolean().default(true),
});

export type JornadasConfig = z.infer<typeof jornadasConfigSchema>;

/** Lê a chave. Ausente ou fora de formato vira o padrão, nunca erro de tela. */
export function lerConfigDasJornadas(value: unknown): JornadasConfig {
  const lido = jornadasConfigSchema.safeParse(value ?? {});
  return lido.success ? lido.data : jornadasConfigSchema.parse({});
}

export function configDaJornada(
  config: JornadasConfig,
  jornada: Jornada,
): { stars: number; ativa: boolean } {
  const gravada = config.porJornada[jornada.id];
  if (!gravada) return { stars: jornada.starsSugeridas, ativa: true };
  return gravada;
}
