import prisma from "@/lib/db";
import { z } from "zod";
import { getPurchaseAccess } from "./_access";
import { p } from "./_shared";

// Cancela um RASCUNHO. Nota já processada não se cancela por aqui: desfazer
// entrada exige estornar estoque, custo e contas a pagar — é outra feature, e
// fingir que um update de status resolve deixaria o estoque mentindo.
export const cancelPurchase = p
  .input(z.object({ id: z.string() }))
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const access = await getPurchaseAccess(context.org.id, context.user.id);
    if (!access.canManage) {
      throw errors.FORBIDDEN({
        message: "Você não tem permissão para cancelar entradas de nota",
      });
    }

    // Compare-and-swap: o status entra no WHERE, então dois cliques não
    // disputam entre ler e escrever.
    const cancelled = await prisma.purchase.updateMany({
      where: {
        id: input.id,
        organizationId: context.org.id,
        status: "PENDING",
      },
      data: { status: "CANCELLED" },
    });

    if (cancelled.count !== 1) {
      const exists = await prisma.purchase.findFirst({
        where: { id: input.id, organizationId: context.org.id },
        select: { status: true },
      });
      if (!exists) {
        throw errors.NOT_FOUND({ message: "Entrada não encontrada" });
      }
      throw errors.BAD_REQUEST({
        message:
          exists.status === "CANCELLED"
            ? "Esta entrada já foi cancelada"
            : "Só é possível cancelar uma entrada pendente",
      });
    }

    return { id: input.id };
  });
