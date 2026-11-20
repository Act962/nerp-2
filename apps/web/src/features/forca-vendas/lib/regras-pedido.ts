// Regras puras do pedido da Força de Vendas — sem Prisma, sem I/O. O servidor
// decide com elas e a tela de pedido mostra a mesma conta enquanto o vendedor
// negocia; ficar num lugar só é o que impede as duas de divergirem.

export type TipoPedido = "VENDA" | "ORCAMENTO" | "BONIFICACAO" | "TROCA";

export type MotivoAprovacao =
  | "DESCONTO"
  | "LIMITE_CREDITO"
  | "INADIMPLENTE"
  | "CLIENTE_BLOQUEADO"
  | "BONIFICACAO"
  | "FLEX_NEGATIVO";

export const MOTIVO_LABEL: Record<MotivoAprovacao, string> = {
  DESCONTO: "Desconto acima do permitido",
  LIMITE_CREDITO: "Acima do limite de crédito",
  INADIMPLENTE: "Cliente com título vencido",
  CLIENTE_BLOQUEADO: "Cliente bloqueado",
  BONIFICACAO: "Bonificação ou troca",
  FLEX_NEGATIVO: "Saldo flex insuficiente",
};

export type PoliticaComercial = {
  /** Desconto (%) que não mexe no flex. */
  descontoLivrePercent: number;
  /** Acima disso o pedido vai para aprovação. Já considera o limite do vendedor. */
  descontoMaximoPercent: number;
  /** Parte do sobrepreço que vira crédito no flex (%). */
  flexCreditoPercent: number;
  /** Quanto o saldo pode ficar negativo, em reais (valor positivo). */
  flexLimiteNegativo: number;
};

export type ItemDaRegra = {
  precoTabela: number;
  precoUnitario: number;
  quantidade: number;
};

export function centavos(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/** Desconto do item sobre a tabela, em %. Negativo quando vendeu acima. */
export function descontoPercent(item: ItemDaRegra): number {
  if (item.precoTabela <= 0) return 0;
  return ((item.precoTabela - item.precoUnitario) / item.precoTabela) * 100;
}

/**
 * Quanto o item mexe no saldo flex.
 *
 * Vender acima da tabela credita `flexCreditoPercent` da diferença. Desconto
 * até o livre não mexe. Desconto além do livre debita a diferença inteira até
 * o piso livre — é a margem que o vendedor "gastou".
 */
export function flexDoItem(
  item: ItemDaRegra,
  politica: PoliticaComercial,
): number {
  if (item.precoTabela <= 0 || item.quantidade <= 0) return 0;
  if (item.precoUnitario > item.precoTabela) {
    return (
      (item.precoUnitario - item.precoTabela) *
      item.quantidade *
      (politica.flexCreditoPercent / 100)
    );
  }
  const pisoLivre =
    item.precoTabela * (1 - politica.descontoLivrePercent / 100);
  if (item.precoUnitario < pisoLivre) {
    return -(pisoLivre - item.precoUnitario) * item.quantidade;
  }
  return 0;
}

/** Bonificação, troca e orçamento não movimentam o flex. */
export function flexDoPedido(
  tipo: TipoPedido,
  itens: ItemDaRegra[],
  politica: PoliticaComercial,
): number {
  if (tipo !== "VENDA") return 0;
  return centavos(
    itens.reduce((soma, item) => soma + flexDoItem(item, politica), 0),
  );
}

export function maiorDescontoPercent(itens: ItemDaRegra[]): number {
  return itens.reduce(
    (maior, item) => Math.max(maior, descontoPercent(item)),
    0,
  );
}

export function totalDoPedido(tipo: TipoPedido, itens: ItemDaRegra[]): number {
  if (tipo === "BONIFICACAO" || tipo === "TROCA") return 0;
  return centavos(
    itens.reduce(
      (soma, item) => soma + item.precoUnitario * item.quantidade,
      0,
    ),
  );
}

export type SituacaoDoCliente = {
  bloqueado: boolean;
  /** Valor vencido e não pago, em reais. */
  vencido: number;
  /** Nulo = a empresa não controla limite deste cliente. */
  limiteCredito: number | null;
  /** Títulos em aberto + pedidos confirmados ainda não faturados. */
  exposicao: number;
};

export function motivosDeAprovacao(args: {
  tipo: TipoPedido;
  itens: ItemDaRegra[];
  politica: PoliticaComercial;
  cliente: SituacaoDoCliente;
  /** Saldo flex + flex previsto dos pedidos ainda não faturados. */
  saldoFlexPrevisto: number;
  bloquearInadimplente: boolean;
}): MotivoAprovacao[] {
  const motivos: MotivoAprovacao[] = [];
  if (args.tipo === "ORCAMENTO") return motivos;

  if (args.tipo === "BONIFICACAO" || args.tipo === "TROCA") {
    motivos.push("BONIFICACAO");
  }
  if (args.cliente.bloqueado) motivos.push("CLIENTE_BLOQUEADO");
  if (args.bloquearInadimplente && args.cliente.vencido > 0) {
    motivos.push("INADIMPLENTE");
  }

  const total = totalDoPedido(args.tipo, args.itens);
  if (
    args.cliente.limiteCredito !== null &&
    total > 0 &&
    args.cliente.exposicao + total > args.cliente.limiteCredito
  ) {
    motivos.push("LIMITE_CREDITO");
  }

  if (args.tipo === "VENDA") {
    // Meio centavo de folga: o percentual sai de uma divisão e um desconto
    // digitado exatamente no limite não pode ser barrado por arredondamento.
    if (
      maiorDescontoPercent(args.itens) >
      args.politica.descontoMaximoPercent + 0.005
    ) {
      motivos.push("DESCONTO");
    }
    const flex = flexDoPedido(args.tipo, args.itens, args.politica);
    if (
      flex < 0 &&
      args.saldoFlexPrevisto + flex < -args.politica.flexLimiteNegativo
    ) {
      motivos.push("FLEX_NEGATIVO");
    }
  }

  return motivos;
}

export type StatusInicial = "DRAFT" | "PENDING_APPROVAL" | "CONFIRMED";

export function statusInicial(
  tipo: TipoPedido,
  motivos: MotivoAprovacao[],
  autoAprovar: boolean,
): StatusInicial {
  if (tipo === "ORCAMENTO") return "DRAFT";
  if (motivos.length === 0 && autoAprovar) return "CONFIRMED";
  return "PENDING_APPROVAL";
}
