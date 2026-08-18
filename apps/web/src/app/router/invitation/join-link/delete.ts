import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { isOrgAdmin } from "@/lib/org-access";

// Apaga a linha: a URL para de funcionar na hora.
export const deleteJoinLink = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Excluir um link aberto de entrada",
    tags: ["invitations"],
  })
  .input(z.object({ id: z.string() }))
  .output(z.object({ success: z.literal(true) }))
  .handler(async ({ input, context, errors }) => {
    if (!(await isOrgAdmin(context.org.id, context.user.id))) {
      throw errors.FORBIDDEN({
        message: "Apenas administradores podem excluir links.",
      });
    }

    const { count } = await prisma.organizationJoinLink.deleteMany({
      where: { id: input.id, organizationId: context.org.id },
    });
    if (count === 0)
      throw errors.NOT_FOUND({ message: "Link não encontrado." });

    return { success: true as const };
  });
