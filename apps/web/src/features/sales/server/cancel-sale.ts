import "server-only";

import { DocumentoFiscal, VendaNaoEncontradaError } from "@nerp/fiscal";
import { fiscal } from "@/features/fiscal/server/container";
import { cancelarNotaDaVenda } from "@/features/fiscal/server/emissao";
import type { SaleOrigin, SaleStatus } from "@/generated/prisma/enums";
import prisma from "@/lib/db";

/**
 * Cancelamento de venda concluída (specs/vendas-cancelamento.md).
 *
 * Ordem importa: a NFC-e é cancelada ANTES e FORA da transação. Ir à SEFAZ não
 * tem volta, e a recusa dela (prazo de 30 min) tem de barrar o estorno — nunca
 * o contrário. Se a nota cancelar e a transação falhar, repetir é seguro: na
 * segunda vez não há mais nota autorizada e o estorno segue.
 */

/** Pedido pago pelo Órbita ou pelo marketplace foi cobrado fora — e se reembolsa fora. */
const ORIGENS_DO_PDV: readonly SaleOrigin[] = [
  "PDV",
  "CATALOGO_APROVACAO",
  "CATALOGO_COZINHA",
];
const STATUS_CANCELAVEIS: SaleStatus[] = ["COMPLETED", "CONFIRMED"];
/** Nota que pode ser autorizada a qualquer instante: cancelar a venda agora deixaria uma nota válida de venda que não existe. */
const NOTA_EM_ANDAMENTO = new Set(["PENDING", "PROCESSING", "CONTINGENCY"]);

export class VendaNaoCancelavelError extends Error {}

export type DestinoDoEstorno = "SESSAO_DA_VENDA" | "SESSAO_ATUAL" | "SEM_CAIXA";

export type ResultadoCancelamento = {
  saleNumber: number;
  notaCancelada: { numero: number; serie: number } | null;
  caixa: DestinoDoEstorno;
  /** Havia dinheiro a devolver e nenhum caixa aberto para registrar a saída. */
  devolverDinheiroManualmente: boolean;
};

export async function cancelarVenda(input: {
  organizationId: string;
  saleId: string;
  userId: string;
  memberId: string;
  justificativa: string;
}): Promise<ResultadoCancelamento> {
  const { organizationId, saleId, userId } = input;
  const justificativa = DocumentoFiscal.validarJustificativa(
    input.justificativa,
  );

  const venda = await prisma.sale.findFirst({
    where: { id: saleId, organizationId },
    select: {
      id: true,
      status: true,
      origin: true,
      saleNumber: true,
      cashSessionId: true,
      cashSession: { select: { status: true } },
      cashMovements: {
        where: { type: "VENDA" },
        select: { amount: true, paymentMethod: true },
      },
      stockMovements: {
        where: { type: "VENDA" },
        select: { productId: true, quantity: true },
      },
    },
  });
  if (!venda) throw new VendaNaoEncontradaError();
  if (venda.status === "CANCELLED")
    throw new VendaNaoCancelavelError("Esta venda já está cancelada.");
  if (!STATUS_CANCELAVEIS.includes(venda.status))
    throw new VendaNaoCancelavelError(
      "Só venda concluída pode ser cancelada aqui. Pedido aguardando aprovação se recusa na tela de pedidos.",
    );
  if (!ORIGENS_DO_PDV.includes(venda.origin))
    throw new VendaNaoCancelavelError(
      "Este pedido foi pago fora do PDV (Órbita ou marketplace): o cancelamento e o reembolso acontecem por lá.",
    );

  const nota = await fiscal.documentos.buscarVigenteDaVenda(
    organizationId,
    saleId,
    65,
  );
  if (nota && NOTA_EM_ANDAMENTO.has(nota.status))
    throw new VendaNaoCancelavelError(
      `A NFC-e nº ${nota.numero} ainda está sendo transmitida. Aguarde a resposta da SEFAZ e tente de novo.`,
    );
  const notaCancelada = await cancelarNotaDaVenda({
    organizationId,
    saleId,
    justificativa,
  });

  const descricao = `Cancelamento da venda #${venda.saleNumber}`;
  const agora = new Date();

  return prisma.$transaction(async (tx) => {
    // Primeiro a troca de status, condicionada ao status lido: o segundo de
    // dois cliques simultâneos encontra zero linhas e não estorna de novo.
    const trocou = await tx.sale.updateMany({
      where: {
        id: saleId,
        organizationId,
        status: { in: STATUS_CANCELAVEIS },
      },
      data: {
        status: "CANCELLED",
        cancelledAt: agora,
        cancelReason: justificativa,
        cancelledById: userId,
      },
    });
    if (trocou.count === 0)
      throw new VendaNaoCancelavelError("Esta venda já está cancelada.");

    // Estoque: o que de fato saiu (os movimentos), não os itens da venda.
    for (const saida of venda.stockMovements) {
      const quantidade = Number(saida.quantity);
      const produto = await tx.product.update({
        where: { id: saida.productId },
        data: { currentStock: { increment: quantidade } },
        select: { currentStock: true },
      });
      const novo = Number(produto.currentStock);
      await tx.stockMovement.create({
        data: {
          organizationId,
          productId: saida.productId,
          type: "DEVOLUCAO",
          quantity: quantidade,
          previousStock: novo - quantidade,
          newStock: novo,
          saleId,
          notes: descricao,
          createdById: userId,
        },
      });
    }

    // Caixa: sessão fechada nunca é reaberta. O estorno vai para a sessão da
    // venda se ainda estiver aberta, senão para a de quem cancela — é da gaveta
    // dela que o dinheiro sai hoje.
    let caixa: DestinoDoEstorno = "SEM_CAIXA";
    let sessaoId: string | null = null;
    if (venda.cashSessionId && venda.cashSession?.status === "OPEN") {
      sessaoId = venda.cashSessionId;
      caixa = "SESSAO_DA_VENDA";
    } else {
      const atual = await tx.cashSession.findFirst({
        where: { organizationId, memberId: input.memberId, status: "OPEN" },
        select: { id: true },
      });
      if (atual) {
        sessaoId = atual.id;
        caixa = "SESSAO_ATUAL";
      }
    }
    if (sessaoId)
      for (const entrada of venda.cashMovements)
        await tx.cashMovement.create({
          data: {
            organizationId,
            sessionId: sessaoId,
            type: "ESTORNO",
            amount: entrada.amount,
            paymentMethod: entrada.paymentMethod,
            saleId,
            description: descricao,
            createdById: userId,
          },
        });

    // Financeiro: CANCELLED some do DRE e do fluxo de caixa, que já ignoram
    // esse status.
    await tx.paymentEntry.updateMany({
      where: { organizationId, saleId },
      data: { status: "CANCELLED" },
    });

    return {
      saleNumber: venda.saleNumber,
      notaCancelada: notaCancelada
        ? { numero: notaCancelada.numero, serie: notaCancelada.serie }
        : null,
      caixa,
      devolverDinheiroManualmente:
        !sessaoId &&
        venda.cashMovements.some((m) => m.paymentMethod === "DINHEIRO"),
    };
  });
}
