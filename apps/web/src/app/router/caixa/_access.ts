import "server-only";

import prisma from "@/lib/db";

export type CaixaMember = { id: string; role: string; permissions: string[] };

// Carrega o member da org ativa para checar as ações de caixa com `memberCan`.
export async function getCaixaMember(
  orgId: string,
  userId: string,
): Promise<CaixaMember | null> {
  return prisma.member.findFirst({
    where: { organizationId: orgId, userId },
    select: { id: true, role: true, permissions: true },
  });
}

export type CaixaMovementLite = {
  type: "ABERTURA" | "SUPRIMENTO" | "SANGRIA" | "VENDA" | "FECHAMENTO";
  amount: number;
  paymentMethod: string | null;
};

// Resumo financeiro de uma sessão. O esperado em dinheiro é o que deveria estar
// na gaveta: abertura + suprimentos + vendas em dinheiro − sangrias. Vendas em
// cartão/PIX entram no total, mas não na gaveta física.
export function summarizeSession(
  openingBalance: number,
  movements: CaixaMovementLite[],
) {
  let suprimentos = 0;
  let sangrias = 0;
  let salesTotal = 0;
  let salesCash = 0;
  for (const movement of movements) {
    if (movement.type === "SUPRIMENTO") suprimentos += movement.amount;
    else if (movement.type === "SANGRIA") sangrias += movement.amount;
    else if (movement.type === "VENDA") {
      salesTotal += movement.amount;
      if (movement.paymentMethod === "DINHEIRO") salesCash += movement.amount;
    }
  }
  const expectedCash = openingBalance + suprimentos + salesCash - sangrias;
  return { suprimentos, sangrias, salesTotal, salesCash, expectedCash };
}
