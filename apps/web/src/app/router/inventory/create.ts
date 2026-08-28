import prisma from "@/lib/db";
import { z } from "zod";
import { p } from "./_shared";

// Abre uma sessão de contagem. Uma org pode ter várias abertas ao mesmo tempo
// (um corredor por contador), então não há trava de exclusividade — o que não
// pode é aplicar duas vezes a mesma.
export const createInventoryCount = p
  .input(
    z.object({
      name: z.string().min(1, "Dê um nome para a contagem"),
      /** Cega por padrão: o contador não vê o saldo do sistema. */
      blind: z.boolean().default(true),
      notes: z.string().optional(),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context }) => {
    const created = await prisma.inventoryCount.create({
      data: {
        organizationId: context.org.id,
        createdById: context.user.id,
        name: input.name,
        blind: input.blind,
        notes: input.notes || null,
      },
      select: { id: true },
    });
    return { id: created.id };
  });
