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

// Cria a entrada como RASCUNHO. Nada de estoque, custo ou financeiro acontece
// aqui — quem move tudo isso é `process.ts`. O rascunho pode nascer sem itens:
// a nota é digitada com o papel na mão e nem sempre numa sentada só.
export const createPurchase = p
  .input(purchaseInput)
  .output(z.object({ id: z.string(), purchaseNumber: z.number() }))
  .handler(async ({ input, context, errors }) => {
    const access = await getPurchaseAccess(context.org.id, context.user.id);
    if (!access.canManage) {
      throw errors.FORBIDDEN({
        message: "Você não tem permissão para lançar entradas de nota",
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

    return prisma.$transaction(async (tx) => {
      // Numeração atômica por org: o UPDATE ... RETURNING trava a linha da
      // organização, que é o que serializa o contador. `count()+1` correria
      // contra o @@unique([organizationId, purchaseNumber]).
      const org = await tx.organization.update({
        where: { id: context.org.id },
        data: { lastPurchaseNumber: { increment: 1 } },
        select: { lastPurchaseNumber: true },
      });

      return tx.purchase.create({
        data: {
          ...purchaseHeaderData(input),
          organizationId: context.org.id,
          purchaseNumber: org.lastPurchaseNumber,
          status: "PENDING",
          createdById: context.user.id,
          items: { createMany: { data: purchaseItemRows(input, products) } },
        },
        select: { id: true, purchaseNumber: true },
      });
    });
  });
