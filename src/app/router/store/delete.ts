import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { canManageStores } from "@/app/router/field-map/_can-manage-stores";
import prisma from "@/lib/db";
import { z } from "zod";

export const deleteStore = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    if (!(await canManageStores(context.org.id, context.user.id))) {
      throw errors.FORBIDDEN({
        message: "Você não tem permissão para excluir lojas",
      });
    }

    const store = await prisma.store.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });

    if (!store) {
      throw errors.NOT_FOUND({ message: "Loja não encontrada" });
    }

    return prisma.store.delete({ where: { id: input.id } });
  });
