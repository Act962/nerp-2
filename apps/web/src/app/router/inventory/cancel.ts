import prisma from "@/lib/db";
import { z } from "zod";
import { p } from "./_shared";

// Descarta a contagem sem mexer no estoque. As linhas contadas ficam gravadas
// de propósito: serve de registro do que foi observado e por que se decidiu
// não aplicar.
export const cancelInventoryCount = p
  .input(z.object({ id: z.string() }))
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const updated = await prisma.inventoryCount.updateMany({
      where: {
        id: input.id,
        organizationId: context.org.id,
        status: "OPEN",
      },
      data: { status: "CANCELLED" },
    });
    if (updated.count === 0) {
      throw errors.BAD_REQUEST({
        message: "Contagem não encontrada ou já encerrada",
      });
    }
    return { id: input.id };
  });
