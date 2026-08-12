import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const deletePriceList = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const existing = await prisma.priceList.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true, isDefault: true },
    });
    if (!existing) {
      throw errors.NOT_FOUND({ message: "Tabela não encontrada" });
    }
    if (existing.isDefault) {
      throw errors.BAD_REQUEST({
        message:
          "Não é possível excluir a tabela padrão. Marque outra como padrão antes.",
      });
    }
    // Cascade cuida das ProductPrice; SetNull dos Customer/CatalogUser/Sale.
    await prisma.priceList.delete({ where: { id: input.id } });
    return { ok: true };
  });
