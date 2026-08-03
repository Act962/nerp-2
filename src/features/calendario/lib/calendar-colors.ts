import type { CommemorativeKind } from "./commemorative-types";
import type { EventStatus, EventType } from "./calendar-item";

/**
 * Cores como classes LITERAIS.
 *
 * O Tailwind 4 varre o código à procura de nomes de classe completos e não
 * enxerga `bg-${kind}-400/20`. Montar a classe por interpolação faz a cor
 * simplesmente não existir em produção — por isso tudo aqui é um mapa estático.
 */

export const TYPE_LABEL: Record<EventType, string> = {
  ACAO_PDV: "Ação no PDV",
  CAMPANHA: "Campanha",
  VISITA: "Visita",
  TREINAMENTO: "Treinamento",
  REUNIAO: "Reunião",
  LANCAMENTO: "Lançamento",
  OUTRO: "Outro",
};

/** Cor de fundo do card no grid, por tipo de evento. */
export const TYPE_COLOR: Record<EventType, string> = {
  ACAO_PDV: "#7c3aed",
  CAMPANHA: "#0ea5e9",
  VISITA: "#10b981",
  TREINAMENTO: "#f59e0b",
  REUNIAO: "#ef4444",
  LANCAMENTO: "#ec4899",
  OUTRO: "#64748b",
};

/** Cor da anotação privada — cinza-azulado, distinta de qualquer tipo. */
export const NOTE_COLOR = "#475569";

export const STATUS_LABEL: Record<EventStatus, string> = {
  PLANEJADO: "Planejado",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
};

export const STATUS_BADGE: Record<EventStatus, string> = {
  PLANEJADO: "bg-muted text-muted-foreground",
  EM_ANDAMENTO: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  CONCLUIDO:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  CANCELADO: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export const KIND_STYLE: Record<CommemorativeKind, string> = {
  FERIADO_NACIONAL: "bg-amber-400/20 text-amber-700 dark:text-amber-300",
  DATA_COMEMORATIVA: "bg-indigo-400/20 text-indigo-700 dark:text-indigo-300",
  VAREJO: "bg-rose-400/20 text-rose-700 dark:text-rose-300",
  GASTRONOMICA: "bg-emerald-400/20 text-emerald-700 dark:text-emerald-300",
  ANIVERSARIO_ESTADO: "bg-cyan-400/20 text-cyan-700 dark:text-cyan-300",
};
