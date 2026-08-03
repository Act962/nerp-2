import type {
  CommemorativeDate,
  CommemorativeKind,
} from "./commemorative-types";

export interface CalendarFavorites {
  suppliers: string[];
  stores: string[];
}

/**
 * O que fazer com a marca naquele tipo de data.
 *
 * É template, não adivinhação: a sugestão combina o TIPO da data com o nome da
 * marca e da loja que a pessoa já marcou como favorita. Preferi isso a inventar
 * ação específica por produto — seria chute apresentado como recomendação.
 */
const ACTION_BY_KIND: Record<CommemorativeKind, string> = {
  FERIADO_NACIONAL:
    "conferir abastecimento na véspera — a venda acontece antes",
  DATA_COMEMORATIVA: "montar ponta de gôndola temática e registrar a foto",
  VAREJO: "conferir preço na gôndola contra o tabloide e reforçar o estoque",
  GASTRONOMICA: "propor degustação ou cross-merchandising da categoria",
  ANIVERSARIO_ESTADO: "confirmar o horário da loja e avaliar ação regional",
};

export interface CommemorativeIdea {
  id: string;
  text: string;
}

/** Até 3 marcas por data: uma lista longa deixa de ser sugestão e vira ruído. */
const MAX_SUPPLIERS = 3;
const MAX_STORES = 3;

export function buildCommemorativeIdeas(
  date: CommemorativeDate,
  favorites: CalendarFavorites,
): CommemorativeIdea[] {
  const action = ACTION_BY_KIND[date.kind];
  const ideas: CommemorativeIdea[] = favorites.suppliers
    .slice(0, MAX_SUPPLIERS)
    .map((supplier) => ({
      id: `${date.id}-${supplier}`,
      text: `${supplier}: ${action}.`,
    }));

  if (favorites.stores.length > 0) {
    const shown = favorites.stores.slice(0, MAX_STORES);
    const rest = favorites.stores.length - shown.length;
    ideas.push({
      id: `${date.id}-lojas`,
      text: `Nas suas lojas — ${shown.join(", ")}${
        rest > 0 ? ` e mais ${rest}` : ""
      } — vale programar a visita para antes da data.`,
    });
  }

  return ideas;
}
