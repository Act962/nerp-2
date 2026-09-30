/**
 * O valor combinado no Órbita, distribuído nos itens da venda.
 *
 * Sem I/O: quem chama lê os itens e grava o resultado. Tudo em centavos, para
 * a soma dos itens bater exatamente com o total combinado — um centavo de
 * diferença viraria divergência entre venda, pagamento e financeiro.
 */

export type ItemDaVenda = { id: string; productId: string; quantity: number };

export type ItemPrecificado = { id: string; unitPrice: number; total: number };

export class ValorCombinadoInvalido extends Error {}

const centavos = (valor: number) => Math.round(valor * 100);

export function distribuirValorCombinado(
  itens: readonly ItemDaVenda[],
  combinado: {
    total?: number;
    items?: readonly { productId: string; unitPrice: number }[];
  },
): { itens: ItemPrecificado[]; total: number } {
  if (itens.length === 0) {
    throw new ValorCombinadoInvalido("A venda não tem itens.");
  }

  // Preço item a item: cada produto da venda precisa vir com o seu.
  if (combinado.items && combinado.items.length > 0) {
    const precoPorProduto = new Map(
      combinado.items.map((item) => [item.productId, item.unitPrice]),
    );
    const precificados = itens.map((item) => {
      const unitario = precoPorProduto.get(item.productId);
      if (unitario === undefined || unitario < 0) {
        throw new ValorCombinadoInvalido(
          `Falta o preço do produto ${item.productId}.`,
        );
      }
      const total = centavos(unitario * item.quantity);
      return { id: item.id, unitPrice: unitario, total: total / 100 };
    });
    const soma = precificados.reduce(
      (acc, item) => acc + centavos(item.total),
      0,
    );
    if (
      combinado.total !== undefined &&
      Math.abs(soma - centavos(combinado.total)) > 1
    ) {
      throw new ValorCombinadoInvalido(
        "O total não bate com a soma dos preços dos itens.",
      );
    }
    return { itens: precificados, total: soma / 100 };
  }

  if (combinado.total === undefined || combinado.total <= 0) {
    throw new ValorCombinadoInvalido(
      "Informe o total ou o preço de cada item.",
    );
  }

  // Só o total: rateio pela quantidade, e a sobra do arredondamento vai para
  // o último item — é o único jeito de a soma fechar no centavo.
  const alvo = centavos(combinado.total);
  const quantidadeTotal = itens.reduce((acc, item) => acc + item.quantity, 0);
  let distribuido = 0;
  const precificados = itens.map((item, indice) => {
    const ultimo = indice === itens.length - 1;
    const parte = ultimo
      ? alvo - distribuido
      : Math.floor((alvo * item.quantity) / quantidadeTotal);
    distribuido += parte;
    return {
      id: item.id,
      unitPrice: Math.round(parte / item.quantity) / 100,
      total: parte / 100,
    };
  });
  return { itens: precificados, total: alvo / 100 };
}
