import { createPurchaseFinanceEntries } from "@/features/financeiro/server/purchase-entries";
import { unitCost } from "@/features/purchases/lib/purchase-totals";
import { MovementType } from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import { z } from "zod";
import { getPurchaseAccess } from "./_access";
import { p } from "./_shared";

// Uma nota de 200 linhas faz ~400 idas ao banco; os 5s padrão do Prisma não
// dão conta contra um Postgres remoto.
const TRANSACTION_TIMEOUT_MS = 30_000;

/**
 * Processa a entrada: é aqui, e só aqui, que a nota deixa de ser papel.
 *
 * Move estoque, reescreve o custo dos produtos, aplica os preços de venda que
 * o operador aceitou e cria as contas a pagar — tudo numa transação só. Ou a
 * nota inteira entra, ou nada entra: meia nota processada é pior que nenhuma,
 * porque ninguém sabe onde parou.
 */
export const processPurchase = p
  .input(z.object({ id: z.string() }))
  .output(
    z.object({
      purchaseNumber: z.number(),
      itemsMoved: z.number(),
      costsUpdated: z.number(),
      pricesUpdated: z.number(),
      payableEntries: z.number(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const access = await getPurchaseAccess(context.org.id, context.user.id);
    if (!access.canProcess) {
      throw errors.FORBIDDEN({
        message: "Você não tem permissão para processar entradas de nota",
      });
    }

    const receivedAt = new Date();

    return prisma.$transaction(
      async (tx) => {
        // 1. Trava por compare-and-swap, ANTES de qualquer efeito colateral.
        //
        // O status entra no WHERE, então a atualização é atômica: dois cliques
        // simultâneos no botão fazem o segundo receber count = 0. Ler o status
        // e conferir com `if` deixaria a janela aberta entre a leitura e a
        // escrita — e aqui essa janela dobraria estoque e dívida.
        const locked = await tx.purchase.updateMany({
          where: {
            id: input.id,
            organizationId: context.org.id,
            status: "PENDING",
          },
          data: { status: "RECEIVED", receivedDate: receivedAt },
        });

        if (locked.count !== 1) {
          const existing = await tx.purchase.findFirst({
            where: { id: input.id, organizationId: context.org.id },
            select: { status: true },
          });
          if (!existing) {
            throw errors.NOT_FOUND({ message: "Entrada não encontrada" });
          }
          throw errors.BAD_REQUEST({
            message:
              existing.status === "RECEIVED"
                ? "Esta entrada já foi processada"
                : "Só é possível processar uma entrada pendente",
          });
        }

        // 2. Carregar DENTRO da transação — o saldo lido fora envelhece.
        const purchase = await tx.purchase.findFirstOrThrow({
          where: { id: input.id, organizationId: context.org.id },
          select: {
            id: true,
            purchaseNumber: true,
            invoiceNumber: true,
            supplierId: true,
            total: true,
            installments: true,
            firstDueDate: true,
            supplier: { select: { name: true } },
            items: {
              orderBy: { sortOrder: "asc" },
              select: {
                productId: true,
                quantity: true,
                unitPrice: true,
                discount: true,
                newSalePrice: true,
              },
            },
          },
        });

        if (purchase.items.length === 0) {
          throw errors.BAD_REQUEST({
            message: "Nenhum produto nesta entrada",
          });
        }

        // 3. Revalidar os produtos contra a organização. O id está persistido
        // no rascunho, mas continua sendo id que veio de fora.
        const productIds = [
          ...new Set(purchase.items.map((item) => item.productId)),
        ];
        const products = await tx.product.findMany({
          where: { id: { in: productIds }, organizationId: context.org.id },
          select: { id: true, trackStock: true },
        });
        if (products.length !== productIds.length) {
          throw errors.NOT_FOUND({
            message: "Algum produto da nota não existe mais nesta organização",
          });
        }
        const tracksStock = new Map(
          products.map((product) => [product.id, product.trackStock]),
        );

        let itemsMoved = 0;
        let costsUpdated = 0;
        let pricesUpdated = 0;

        // 4. Item a item, sem ler-modificar-escrever: o incremento é atômico e
        // o saldo anterior sai do valor devolvido.
        for (const item of purchase.items) {
          const trackStock = tracksStock.get(item.productId) === true;
          const cost = unitCost({
            quantity: item.quantity.toNumber(),
            unitPrice: item.unitPrice.toNumber(),
            discount: item.discount.toNumber(),
          });

          const updated = await tx.product.update({
            where: { id: item.productId },
            data: {
              ...(trackStock
                ? { currentStock: { increment: item.quantity } }
                : {}),
              // Custo zero é bonificação ou brinde: gravar zeraria o custo do
              // produto e destruiria a margem em todos os relatórios.
              ...(cost > 0 ? { costPrice: cost } : {}),
              // Só o que o operador aceitou. Nunca recalculamos a sugestão
              // aqui: ele aprovaria um preço e gravaríamos outro.
              ...(item.newSalePrice ? { salePrice: item.newSalePrice } : {}),
            },
            select: { currentStock: true },
          });

          if (cost > 0) costsUpdated += 1;
          if (item.newSalePrice) pricesUpdated += 1;

          // Produto sem controle de estoque tem custo, mas não tem movimento.
          if (!trackStock) continue;

          const newStock = updated.currentStock;
          // Aritmética Decimal, não Number: o saldo é Decimal(10,3) e a
          // subtração em ponto flutuante devolveria 49.99999999.
          const previousStock = newStock.minus(item.quantity);

          await tx.stockMovement.create({
            data: {
              organizationId: context.org.id,
              productId: item.productId,
              type: MovementType.COMPRA,
              quantity: item.quantity,
              previousStock,
              newStock,
              unitCost: cost,
              purchaseId: purchase.id,
              createdById: context.user.id,
              notes: purchase.invoiceNumber
                ? `NF ${purchase.invoiceNumber}`
                : null,
            },
          });
          itemsMoved += 1;
        }

        // 5. Contas a pagar, na mesma transação: financeiro órfão não pode
        // sobreviver a uma nota que voltou atrás.
        const payableEntries = await createPurchaseFinanceEntries(tx, {
          organizationId: context.org.id,
          purchaseId: purchase.id,
          purchaseNumber: purchase.purchaseNumber,
          invoiceNumber: purchase.invoiceNumber,
          supplierId: purchase.supplierId,
          supplierName: purchase.supplier?.name ?? null,
          total: purchase.total.toNumber(),
          installments: purchase.installments,
          firstDueDate: purchase.firstDueDate,
          receivedAt,
          createdById: context.user.id,
        });

        return {
          purchaseNumber: purchase.purchaseNumber,
          itemsMoved,
          costsUpdated,
          pricesUpdated,
          payableEntries,
        };
      },
      { timeout: TRANSACTION_TIMEOUT_MS },
    );
  });
