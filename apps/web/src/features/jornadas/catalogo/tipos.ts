import type { PagePermissionKey } from "@/lib/permissions";

/**
 * Uma jornada guiada: o Astro ensina uma tela passo a passo, e QUEM CLICA é a
 * pessoa. Nunca o sistema por ela — um tour que faz sozinho mostra o caminho e
 * não ensina ninguém a andar nele.
 */

/**
 * Como o passo avança.
 *
 * - `ler` — só explica; avança no botão "Próximo", respeitado o tempo mínimo.
 * - `clicar` — avança quando a pessoa clica no alvo, e em nenhuma outra coisa.
 * - `digitar` — avança quando o campo do alvo deixa de estar vazio.
 * - `navegar` — não tem alvo: espera a pessoa chegar em `destino`.
 */
export type TipoDePasso = "ler" | "clicar" | "digitar" | "navegar";

export interface Passo {
  /** Valor do `data-jornada` do elemento destacado. Ausente só em `navegar`. */
  alvo?: string;
  tipo: TipoDePasso;
  titulo: string;
  texto: string;
  /** Onde este passo acontece. Sem isto, vale a `rota` da jornada. */
  rota?: string;
  /** Em `navegar`: para onde a pessoa precisa ir. */
  destino?: string;
  /** O alvo mora na sidebar — o motor a abre antes de procurar. */
  precisaDaSidebar?: boolean;
  /**
   * Um `data-jornada` para clicar ANTES, quando o alvo não estiver na tela.
   * Existe por causa do `Collapsible` do menu: fechado, ele não monta os
   * filhos, e procurar o sub-item ali é procurar o que não existe.
   */
  abrirAntes?: string;
  /** Sobrescreve o tempo mínimo de leitura calculado pelo tamanho do texto. */
  tempoMinimoMs?: number;
  /**
   * O alvo pode legitimamente não existir — e aí o passo é pulado em silêncio.
   *
   * Muita coisa da tela é condicional: atalho que a pessoa ainda não escolheu,
   * botão que só o administrador vê, bloco que some sem dados. Sem isto, a
   * jornada trava em "não achei esta parte da tela" para quem não fez nada de
   * errado.
   */
  opcional?: boolean;
}

export interface Jornada {
  /** Estável e para sempre: é a chave do progresso e do preço em ★. */
  id: string;
  /** A chave de `PAGE_PERMISSIONS` da tela. Filtra quem pode ver a jornada. */
  modulo: PagePermissionKey;
  titulo: string;
  /** O que a pessoa sai sabendo. Vai no convite, antes de ela decidir. */
  descricao: string;
  /** O endereço onde a jornada começa. */
  rota: string;
  /** Valor padrão em ★. O admin da plataforma pode trocar sem deploy. */
  starsSugeridas: number;
  passos: readonly Passo[];
}
