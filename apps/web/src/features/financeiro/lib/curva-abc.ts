/**
 * Curva ABC — a regra de Pareto aplicada ao que a loja vendeu.
 *
 * O princípio: uma minoria dos produtos responde pela maioria do resultado.
 * A classificação ordena do maior para o menor e corta pelo ACUMULADO, não
 * pela posição: classe A vai até 80% do total, B até 95%, C o resto. Cortar
 * por posição ("os 20% primeiros são A") daria classes que mudam de significado
 * conforme o tamanho do catálogo.
 *
 * O mesmo cálculo serve aos dois critérios que o varejo usa:
 *
 * - **valor** — quanto cada produto trouxe em dinheiro. É o que manda na
 *   negociação com o fornecedor e na atenção da gôndola.
 * - **volume** — quantas unidades saíram. É o que manda no estoque e na
 *   reposição, e quase nunca dá a mesma lista: item barato de alto giro é A em
 *   volume e C em valor.
 *
 * Módulo puro: recebe o que já foi somado no banco e devolve a classificação.
 */

export type CriterioAbc = "valor" | "volume";

/** Os cortes do acumulado. Clássicos, e é isso que a tela explica. */
export const CORTE_A = 0.8;
export const CORTE_B = 0.95;

export type ItemVendido = {
  produtoId: string;
  nome: string;
  sku: string | null;
  /** R$ que o produto trouxe no período. */
  valor: number;
  /** Unidades vendidas no período. */
  volume: number;
};

export type ItemDaCurva = ItemVendido & {
  classe: "A" | "B" | "C";
  /** Fatia deste item no total do critério, de 0 a 1. */
  fatia: number;
  /** Fatia acumulada até este item, inclusive. */
  acumulado: number;
  /** 1 para o maior do critério. */
  posicao: number;
};

export type ResumoDaClasse = {
  classe: "A" | "B" | "C";
  itens: number;
  valor: number;
  volume: number;
  /** Fatia da classe no total do critério. */
  fatia: number;
};

export type CurvaAbc = {
  criterio: CriterioAbc;
  itens: ItemDaCurva[];
  classes: ResumoDaClasse[];
  total: number;
};

function medida(item: ItemVendido, criterio: CriterioAbc): number {
  return criterio === "valor" ? item.valor : item.volume;
}

/**
 * Classifica os itens pelo critério pedido.
 *
 * Itens sem medida positiva ficam de fora: produto que não vendeu nada no
 * período não é "classe C", é ausente — misturá-lo inflaria a contagem de C e
 * faria a curva parecer mais concentrada do que é.
 */
export function classificarAbc(
  itens: readonly ItemVendido[],
  criterio: CriterioAbc,
): CurvaAbc {
  const participantes = itens
    .filter((item) => medida(item, criterio) > 0)
    .sort((a, b) => medida(b, criterio) - medida(a, criterio));

  const total = participantes.reduce(
    (soma, item) => soma + medida(item, criterio),
    0,
  );

  let acumuladoBruto = 0;
  const classificados: ItemDaCurva[] = participantes.map((item, indice) => {
    const valorDaMedida = medida(item, criterio);
    // A classe olha o acumulado ANTES deste item. É o que faz o item que
    // CRUZA os 80% ainda ser A — e é a diferença que decide a classe do
    // produto mais importante de uma loja com poucos itens: olhando o
    // acumulado já com ele somado, o único produto de um catálogo fecharia
    // 100% e cairia em C.
    const acumuladoAntes = total > 0 ? acumuladoBruto / total : 0;
    acumuladoBruto += valorDaMedida;
    return {
      ...item,
      posicao: indice + 1,
      fatia: total > 0 ? valorDaMedida / total : 0,
      acumulado: total > 0 ? acumuladoBruto / total : 0,
      classe:
        acumuladoAntes < CORTE_A ? "A" : acumuladoAntes < CORTE_B ? "B" : "C",
    };
  });

  const classes = (["A", "B", "C"] as const).map((classe) => {
    const doGrupo = classificados.filter((item) => item.classe === classe);
    return {
      classe,
      itens: doGrupo.length,
      valor: doGrupo.reduce((soma, item) => soma + item.valor, 0),
      volume: doGrupo.reduce((soma, item) => soma + item.volume, 0),
      fatia:
        total > 0
          ? doGrupo.reduce((soma, item) => soma + medida(item, criterio), 0) /
            total
          : 0,
    };
  });

  return { criterio, itens: classificados, classes, total };
}
