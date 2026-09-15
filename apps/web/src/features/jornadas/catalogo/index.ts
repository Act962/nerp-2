import { JORNADA_DASHBOARD } from "./dashboard";
import { JORNADA_PRODUTOS } from "./produtos";
import type { Jornada } from "./tipos";
import { JORNADA_PDV } from "./vendas";
import { casaRota } from "../lib/rota";

export type { Jornada, Passo, TipoDePasso } from "./tipos";

/**
 * O catálogo das jornadas guiadas.
 *
 * Vive em código, e não no banco, por dois motivos: o passo aponta para um
 * `data-jornada` que só existe porque alguém o escreveu no componente — texto e
 * tela viajam juntos, e separá-los daria jornada apontando para botão que não
 * existe mais. E porque assim o servidor confere o tempo mínimo lendo a MESMA
 * lista que o navegador mostrou.
 *
 * O que o admin da plataforma controla sem deploy é o preço em ★ e se a
 * jornada está no ar (`SiteSetting`, chave `jornadas`).
 */
export const JORNADAS: readonly Jornada[] = [
  JORNADA_DASHBOARD,
  JORNADA_PRODUTOS,
  JORNADA_PDV,
];

export function jornadaPorId(id: string): Jornada | null {
  return JORNADAS.find((jornada) => jornada.id === id) ?? null;
}

/** As jornadas que começam nesta tela — é o que o convite flutuante oferece. */
export function jornadasQueComecamEm(pathname: string): Jornada[] {
  return JORNADAS.filter((jornada) => casaRota(jornada.rota, pathname));
}
