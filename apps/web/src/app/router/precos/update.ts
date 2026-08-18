import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const updatePriceList = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      description: z.string().nullable().optional(),
      isDefault: z.boolean().optional(),
      isActive: z.boolean().optional(),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const existing = await prisma.priceList.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true, isDefault: true },
    });
    if (!existing) {
      throw errors.NOT_FOUND({ message: "Tabela de preço não encontrada" });
    }

    // Se está marcando essa como default, tira o default das outras.
    // Se está desmarcando (era default), impede — a org deve ter sempre uma.
    if (input.isDefault === false && existing.isDefault) {
      throw errors.BAD_REQUEST({
        message: "Marque outra tabela como padrão antes de desmarcar esta.",
      });
    }

    await prisma.$transaction(async (tx) => {
      if (input.isDefault === true && !existing.isDefault) {
        await tx.priceList.updateMany({
          where: {
            organizationId: context.org.id,
            isDefault: true,
            NOT: { id: input.id },
          },
          data: { isDefault: false },
        });
      }
      await tx.priceList.update({
        where: { id: input.id },
        data: {
          name: input.name,
          description: input.description,
          isDefault: input.isDefault,
          isActive: input.isActive,
        },
      });
    });

    return { id: input.id };
  });
