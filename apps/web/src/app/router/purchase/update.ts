import prisma from "@/lib/db";
import { z } from "zod";
import { getPurchaseAccess } from "./_access";
import {
  loadProductsInOrg,
  purchaseHeaderData,
  purchaseInput,
  purchaseItemRows,
  supplierBelongsToOrg,
} from "./_input";
import { p } from "./_shared";

// Edita o rascunho. Itens em replace-all: um diff linha a linha não traria
// nada aqui e complicaria manter `sortOrder` coerente com o que está na tela.
export const updatePurchase = p
  .input(purchaseInput.extend({ id: z.string() }))
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const access = await getPurchaseAccess(context.org.id, context.user.id);
    if (!access.canManage) {
      throw errors.FORBIDDEN({
        message: "Você não tem permissão para editar entradas de nota",
      });
    }

    const purchase = await prisma.purchase.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true, status: true },
    });
    if (!purchase) {
      throw errors.NOT_FOUND({ message: "Entrada não encontrada" });
    }
    if (purchase.status !== "PENDING") {
      throw errors.BAD_REQUEST({
        message: "Só é possível editar uma entrada pendente",
      });
    }

    if (
      input.supplierId &&
      !(await supplierBelongsToOrg(context.org.id, input.supplierId))
    ) {
      throw errors.NOT_FOUND({ message: "Fornecedor não encontrado" });
    }

    const products = await loadProductsInOrg(
      context.org.id,
      input.items.map((item) => item.productId),
    );
    if (!products) {
      throw errors.NOT_FOUND({
        message: "Algum produto da nota não existe nesta organização",
      });
    }

    await prisma.$transaction(async (tx) => {
      // O findFirst acima já provou que a nota é desta organização, e
      // PurchaseItem não carrega organizationId — o escopo dele é o pai.
      await tx.purchaseItem.deleteMany({ where: { purchaseId: purchase.id } });
      await tx.purchase.update({
        where: { id: purchase.id },
        data: {
          ...purchaseHeaderData(input),
          items: { createMany: { data: purchaseItemRows(input, products) } },
        },
      });
    });

    return { id: purchase.id };
  });
