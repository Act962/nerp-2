import type { CommemorativeDate } from "./commemorative-types";

/**
 * Aniversário (data de criação/emancipação) das 27 unidades federativas.
 *
 * Só aparecem nas UFs em que a organização tem loja — o promotor de Teresina
 * não precisa do aniversário de Santa Catarina na tela.
 */
const STATES: Record<string, { date: string; name: string }> = {
  AC: { date: "06-15", name: "Acre" },
  AL: { date: "09-16", name: "Alagoas" },
  AM: { date: "09-05", name: "Amazonas" },
  AP: { date: "10-05", name: "Amapá" },
  BA: { date: "07-02", name: "Bahia" },
  CE: { date: "03-25", name: "Ceará" },
  DF: { date: "04-21", name: "Distrito Federal" },
  ES: { date: "05-23", name: "Espírito Santo" },
  GO: { date: "07-18", name: "Goiás" },
  MA: { date: "07-28", name: "Maranhão" },
  MG: { date: "12-16", name: "Minas Gerais" },
  MS: { date: "10-11", name: "Mato Grosso do Sul" },
  MT: { date: "05-20", name: "Mato Grosso" },
  PA: { date: "08-15", name: "Pará" },
  PB: { date: "08-05", name: "Paraíba" },
  PE: { date: "03-06", name: "Pernambuco" },
  PI: { date: "10-19", name: "Piauí" },
  PR: { date: "12-19", name: "Paraná" },
  RJ: { date: "03-01", name: "Rio de Janeiro" },
  RN: { date: "08-07", name: "Rio Grande do Norte" },
  RO: { date: "01-04", name: "Rondônia" },
  RR: { date: "10-05", name: "Roraima" },
  RS: { date: "09-20", name: "Rio Grande do Sul" },
  SC: { date: "08-11", name: "Santa Catarina" },
  SE: { date: "07-08", name: "Sergipe" },
  SP: { date: "07-09", name: "São Paulo" },
  TO: { date: "10-05", name: "Tocantins" },
};

/** Índice "MM-DD" → aniversários, restrito às UFs informadas. */
export function buildStateAnniversaries(
  ufs: string[],
): Record<string, CommemorativeDate[]> {
  const map: Record<string, CommemorativeDate[]> = {};

  for (const uf of ufs) {
    const state = STATES[uf.toUpperCase()];
    if (!state) continue;

    const entry: CommemorativeDate = {
      id: `uf-${uf.toUpperCase()}`,
      label: `🎂 ${uf.toUpperCase()}`,
      title: `Aniversário de ${state.name}`,
      description: `Data de ${state.name}.`,
      impact:
        "Costuma virar feriado ou ponto facultativo local, com ações regionais no varejo.",
      tips: [
        "Confirme com a loja se abre e em que horário",
        "Vale ação de produto regional",
      ],
      kind: "ANIVERSARIO_ESTADO",
      uf: uf.toUpperCase(),
    };

    const list = map[state.date];
    if (list) list.push(entry);
    else map[state.date] = [entry];
  }

  return map;
}
