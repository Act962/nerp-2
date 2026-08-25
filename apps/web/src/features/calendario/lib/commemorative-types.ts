/**
 * Datas comemorativas do calendário.
 *
 * Vivem em CÓDIGO, nunca no banco: são as mesmas para toda organização, as
 * móveis são calculáveis a partir da Páscoa, e guardá-las em linhas exigiria
 * um seed por org e um backfill todo ano.
 */
export type CommemorativeKind =
  | "FERIADO_NACIONAL"
  | "DATA_COMEMORATIVA"
  | "VAREJO"
  | "GASTRONOMICA"
  | "ANIVERSARIO_ESTADO";

export interface CommemorativeDate {
  /** Estável — vira key de React e chave de filtro. Ex.: "feriado-natal". */
  id: string;
  /** Curto, cabe na célula do mês. Ex.: "🛍️ Black Friday". */
  label: string;
  title: string;
  description: string;
  /** O que essa data significa para o PDV. */
  impact: string;
  tips: string[];
  kind: CommemorativeKind;
  /** Só em ANIVERSARIO_ESTADO. */
  uf?: string;
}

export const KIND_LABEL: Record<CommemorativeKind, string> = {
  FERIADO_NACIONAL: "Feriado nacional",
  DATA_COMEMORATIVA: "Data comemorativa",
  VAREJO: "Data de varejo",
  GASTRONOMICA: "Data gastronômica",
  ANIVERSARIO_ESTADO: "Aniversário de estado",
};
