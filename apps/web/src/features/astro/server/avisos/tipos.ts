/**
 * O vocabulário dos avisos.
 *
 * Módulo neutro, sem `server-only`: a central de avisos e o widget desenham o
 * ícone e a cor a partir daqui. Tipo e severidade são texto no banco e lista
 * fechada em código — acrescentar um tipo é uma linha, e não uma migration.
 */

export const TIPOS_DE_AVISO = [
  "estoque_baixo",
  "ticket_abaixo",
  "evento_proximo",
  "contrato_vencendo",
  "stars_baixas",
  "sandbox_expira",
] as const;

export type TipoDeAviso = (typeof TIPOS_DE_AVISO)[number];

export const SEVERIDADES = ["alta", "media", "baixa"] as const;
export type Severidade = (typeof SEVERIDADES)[number];

/** Para ordenar: o mais grave primeiro, e é ele que o mascote fala. */
export const PESO_DA_SEVERIDADE: Record<Severidade, number> = {
  alta: 3,
  media: 2,
  baixa: 1,
};

/** O rótulo curto de cada tipo, para a central. */
export const ROTULO_DO_TIPO: Record<TipoDeAviso, string> = {
  estoque_baixo: "Estoque",
  ticket_abaixo: "Vendas",
  evento_proximo: "Calendário",
  contrato_vencendo: "Trade Marketing",
  stars_baixas: "Stars",
  sandbox_expira: "Conta de teste",
};

/**
 * Um aviso antes de existir no banco.
 *
 * `dedupeKey` é `tipo:chave:AAAA-MM-DD`: é ela que faz o cron rodar três vezes
 * ao dia sem criar três avisos iguais.
 */
export type CandidatoAAviso = {
  tipo: TipoDeAviso;
  severidade: Severidade;
  titulo: string;
  corpo: string;
  dados?: Record<string, unknown>;
  dedupeKey: string;
};

export function ehTipoDeAviso(valor: string): valor is TipoDeAviso {
  return (TIPOS_DE_AVISO as readonly string[]).includes(valor);
}

export function ehSeveridade(valor: string): valor is Severidade {
  return (SEVERIDADES as readonly string[]).includes(valor);
}

/** O peso de uma severidade que veio do banco como texto solto. */
export function pesoDaSeveridade(valor: string): number {
  return ehSeveridade(valor) ? PESO_DA_SEVERIDADE[valor] : 0;
}
