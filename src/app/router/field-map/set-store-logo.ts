import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";
import { canManageStores } from "./_can-manage-stores";

/**
 * Logo/fachada do cliente, trocada direto do mapa.
 *
 * O OpenStreetMap não tem logo de loja — quem importa recebe pinos sem marca e
 * precisa de um caminho curto para dar rosto a eles sem sair do mapa.
 */
export const setStoreLogo = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      id: z.string(),
      /** Chave R2 já enviada pelo cliente; `null` remove a logo. */
      coverImageKey: z.string().trim().min(1).nullable(),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    if (!(await canManageStores(context.org.id, context.user.id))) {
      throw errors.FORBIDDEN({
        message: "Você não tem permissão para editar clientes",
      });
    }

    const store = await prisma.store.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!store) {
      throw errors.NOT_FOUND({ message: "Cliente não encontrado" });
    }

    await prisma.store.update({
      where: { id: store.id },
      data: { coverImageKey: input.coverImageKey },
    });

    return { id: store.id };
  });
