/**
 * Domínio da SESSÃO DE CAIXA no device — tipos, máquina de estados e o resumo da
 * gaveta, PUROS (sem I/O).
 *
 * O caixa (`CashSession`) é o LIVRO da gaveta de uma jornada de venda: abre com um
 * fundo, recebe movimentos (venda/sangria/suprimento) e fecha com contagem cega.
 * É um conceito distinto de venda e de pagamento: `CashMovement` = impacto no
 * caixa; só a parcela em DINHEIRO afeta a gaveta física.
 *
 * O operador é uma identidade PLUGÁVEL (`openedBy`): hoje vem do usuário pareado,
 * amanhã pode vir de um login/PIN — sem remexer neste domínio.
 */

export type CashSessionState = "open" | "closed";

export const CASH_SESSION_TRANSITIONS: Record<
  CashSessionState,
  readonly CashSessionState[]
> = {
  open: ["closed"],
  closed: [],
};

export function canTransitionCashSession(
  from: CashSessionState,
  to: CashSessionState,
): boolean {
  return CASH_SESSION_TRANSITIONS[from].includes(to);
}

/** Tipos de movimento de caixa (espelham o enum `CashMovementType` do server). */
export type CashMovementKind =
  | "ABERTURA"
  | "SUPRIMENTO"
  | "SANGRIA"
  | "VENDA"
  | "FECHAMENTO";

export type LocalCashMovement = {
  kind: CashMovementKind;
  /** Sempre positivo; a direção vem do `kind`. */
  amount: number;
  /** Só em VENDA — usado para filtrar o que afeta a gaveta (DINHEIRO). */
  paymentMethod?: string;
  /** Chave de idempotência do replay (sangria/suprimento). */
  clientOperationId?: string;
  saleClientId?: string;
  description?: string;
  createdAt: string; // ISO
};

/** Identidade de quem operou — plugável (hoje o usuário pareado). */
export type Operator = { name: string; userId?: string };

export type LocalCashSession = {
  /** Id local (o `operationId` do "abrir") — âncora do replay e do vínculo da venda. */
  clientSessionId: string;
  openingBalance: number;
  openedBy: Operator;
  openedAt: string; // ISO
  registerName: string;
  status: CashSessionState;
  movements: LocalCashMovement[];
  /** Preenchido no fechamento (contagem cega). */
  countedBalance?: number;
  closedAt?: string; // ISO
};

export type CashSummary = {
  suprimentos: number;
  sangrias: number;
  salesTotal: number;
  salesCash: number;
  expectedCash: number;
};

/**
 * Resumo financeiro da sessão. O esperado na GAVETA é
 * `abertura + suprimentos + vendas em DINHEIRO − sangrias`. Cartão/PIX entram no
 * total da sessão, mas NÃO na gaveta física. Porta pura do `summarizeSession` do
 * servidor (`router/caixa/_access.ts`) — o server continua sendo a autoridade
 * final; aqui é só para a contagem cega local revelar a diferença.
 */
export function summarizeCash(
  openingBalance: number,
  movements: LocalCashMovement[],
): CashSummary {
  let suprimentos = 0;
  let sangrias = 0;
  let salesTotal = 0;
  let salesCash = 0;
  for (const movement of movements) {
    if (movement.kind === "SUPRIMENTO") suprimentos += movement.amount;
    else if (movement.kind === "SANGRIA") sangrias += movement.amount;
    else if (movement.kind === "VENDA") {
      salesTotal += movement.amount;
      if (movement.paymentMethod === "DINHEIRO") salesCash += movement.amount;
    }
  }
  const expectedCash = openingBalance + suprimentos + salesCash - sangrias;
  return { suprimentos, sangrias, salesTotal, salesCash, expectedCash };
}
