import {
  JORNADA_CATALOGO_ONLINE,
  JORNADA_CATALOGO_PROMOCIONAL,
} from "./catalogos";
import { JORNADA_CLIENTES, JORNADA_FORNECEDORES } from "./cadastros";
import { JORNADA_DASHBOARD } from "./dashboard";
import { JORNADA_ESTOQUE } from "./estoque";
import { JORNADA_FINANCEIRO } from "./financeiro";
import {
  JORNADA_CAIXA,
  JORNADA_COLABORADORES,
  JORNADA_CONFIGURACOES,
  JORNADA_VENDAS,
} from "./operacao";
import { JORNADA_PEDIDOS } from "./pedidos";
import { JORNADA_PRECOS } from "./precos";
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
 *
 * A ordem aqui é a da barra lateral: é ela que a lista dentro do painel do
 * Astro mostra, e seguir o menu é o que faz a lista parecer o sistema.
 */
export const JORNADAS: readonly Jornada[] = [
  JORNADA_DASHBOARD,
  JORNADA_PRODUTOS,
  JORNADA_PRECOS,
  JORNADA_PDV,
  JORNADA_VENDAS,
  JORNADA_CAIXA,
  JORNADA_PEDIDOS,
  JORNADA_ESTOQUE,
  JORNADA_FINANCEIRO,
  JORNADA_CLIENTES,
  JORNADA_FORNECEDORES,
  JORNADA_CATALOGO_ONLINE,
  JORNADA_CATALOGO_PROMOCIONAL,
  JORNADA_COLABORADORES,
  JORNADA_CONFIGURACOES,
];

export function jornadaPorId(id: string): Jornada | null {
  return JORNADAS.find((jornada) => jornada.id === id) ?? null;
}

/** As jornadas que começam nesta tela — é o que o convite flutuante oferece. */
export function jornadasQueComecamEm(pathname: string): Jornada[] {
  return JORNADAS.filter((jornada) => casaRota(jornada.rota, pathname));
}
