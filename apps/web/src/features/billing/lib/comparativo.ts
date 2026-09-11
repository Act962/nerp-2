/**
 * A forma mínima de que o comparativo precisa. Não é a `AstroPricing` inteira
 * de propósito: a tela do cliente recebe só a faixa por módulo, e tipar pelo
 * que se usa é o que impede a procedure de crescer sem ninguém notar.
 */
export type TabelaDeAvulsos = {
  ativo: boolean;
  modulos: readonly { toolId: string; minCents: number; maxCents: number }[];
};

/**
 * Quanto custaria pagar cada ferramenta separada.
 *
 * É o argumento central da tela de planos: o cliente não compara o nerp com
 * "nada", compara com a soma do que já paga hoje em três ou quatro
 * assinaturas. Para uma operação de varejo real, só o ERP fica entre R$ 189 e
 * R$ 299 por mês; WhatsApp com CRM, entre R$ 99 e R$ 599; trade marketing é
 * cotação fechada.
 *
 * A fonte é a tabela `astro-precos` (`modulos[{ toolId, minCents, maxCents }]`),
 * a MESMA que o consultor do site usa para estimar — cadastrada em
 * `/site/precos`. Uma segunda tabela em código criaria dois preços para a
 * mesma ferramenta, e o dia em que divergissem seria o dia de uma proposta
 * errada.
 *
 * **Sem tabela, não há número.** É a regra que já vale no site: preço
 * inventado vira promessa comercial, e nenhum ajuste de texto desfaz isso.
 * Por isso o retorno é explícito sobre indisponibilidade, em vez de zero.
 */

export type Comparativo =
  | { disponivel: false; motivo: "sem_tabela" | "sem_modulos" }
  | {
      disponivel: true;
      minCents: number;
      maxCents: number;
      /**
       * Quantas ferramentas entraram na conta. A tela mostra este número: o
       * catálogo do site não cobre tudo o que o nerp tem (Astro, Financeiro e
       * Pedidos não estão lá), e dizer "todas" seria mentira.
       */
      ferramentas: number;
      /** Quantas ficaram de fora por não terem preço cadastrado. */
      semPreco: number;
    };

export function compararComAvulso(
  tabela: TabelaDeAvulsos | null | undefined,
  ferramentas: readonly string[],
): Comparativo {
  if (!tabela?.ativo || tabela.modulos.length === 0) {
    return { disponivel: false, motivo: "sem_tabela" };
  }

  const precoPorId = new Map(
    tabela.modulos.map((modulo) => [modulo.toolId, modulo]),
  );

  let minCents = 0;
  let maxCents = 0;
  let contadas = 0;

  for (const id of new Set(ferramentas)) {
    const preco = precoPorId.get(id);
    if (!preco) continue;
    minCents += preco.minCents;
    maxCents += preco.maxCents;
    contadas += 1;
  }

  if (contadas === 0) return { disponivel: false, motivo: "sem_modulos" };

  return {
    disponivel: true,
    minCents,
    maxCents,
    ferramentas: contadas,
    semPreco: new Set(ferramentas).size - contadas,
  };
}

/**
 * Quanto o plano economiza, em porcentagem, contra o piso do avulso.
 *
 * O PISO, e não a média: o desconto anunciado tem de ser o que se sustenta no
 * pior caso para nós. `null` quando o plano não sai mais barato — e aí a tela
 * não fala em economia, porque economia que não existe se descobre na primeira
 * conta que o cliente faz.
 */
export function economiaPercentual(
  comparativo: Comparativo,
  precoDoPlanoCentavos: number | null,
): number | null {
  if (!comparativo.disponivel) return null;
  if (precoDoPlanoCentavos === null || precoDoPlanoCentavos <= 0) return null;
  if (comparativo.minCents <= precoDoPlanoCentavos) return null;

  const economia =
    (comparativo.minCents - precoDoPlanoCentavos) / comparativo.minCents;
  return Math.round(economia * 100);
}
