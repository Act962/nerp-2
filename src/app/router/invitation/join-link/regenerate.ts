import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { buildJoinLink, generateJoinToken } from "@/lib/join-link";
import { isOrgAdmin } from "@/lib/org-access";

/**
 * Troca o token do link, mantendo nome e permissões.
 *
 * É a única forma de revogar algo que pode ter sido encaminhado para qualquer
 * lugar: a URL antiga deixa de existir no mesmo instante.
 */
export const regenerateJoinLink = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Gerar um token novo para o link",
    tags: ["invitations"],
  })
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    if (!(await isOrgAdmin(context.org.id, context.user.id))) {
      throw errors.FORBIDDEN({
        message: "Apenas administradores podem regenerar links.",
      });
    }

    const existing = await prisma.organizationJoinLink.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!existing) throw errors.NOT_FOUND({ message: "Link não encontrado." });

    const link = await prisma.organizationJoinLink.update({
      where: { id: existing.id },
      data: { token: generateJoinToken() },
      select: { token: true },
    });

    return { url: buildJoinLink(link.token) };
  });
