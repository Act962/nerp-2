import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { buildJoinLink } from "@/lib/join-link";
import { isOrgAdmin } from "@/lib/org-access";
import prisma from "@/lib/db";

/**
 * Link aberto de entrada da organização, para o admin ver/copiar/gerar o QR.
 *
 * Só admin: o token é a credencial inteira — quem o vê consegue colocar gente
 * dentro da empresa.
 */
export const getJoinLink = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Link aberto de entrada da organização",
    tags: ["invitations"],
  })
  .input(z.object({}))
  .handler(async ({ context, errors }) => {
    if (!(await isOrgAdmin(context.org.id, context.user.id))) {
      throw errors.FORBIDDEN({
        message: "Apenas administradores podem ver o link de convite.",
      });
    }

    const link = await prisma.organizationJoinLink.findUnique({
      where: { organizationId: context.org.id },
      select: {
        token: true,
        permissions: true,
        expiresAt: true,
        createdAt: true,
      },
    });
    if (!link) return { link: null };

    return {
      link: {
        url: buildJoinLink(link.token),
        permissions: link.permissions,
        expiresAt: link.expiresAt?.toISOString() ?? null,
        isExpired: link.expiresAt
          ? link.expiresAt.getTime() < Date.now()
          : false,
        createdAt: link.createdAt.toISOString(),
      },
    };
  });
