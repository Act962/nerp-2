import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { buildJoinLink } from "@/lib/join-link";
import { isOrgAdmin } from "@/lib/org-access";

/**
 * Links abertos de entrada da organização.
 *
 * Só admin: o token é a credencial inteira — quem o vê consegue colocar gente
 * dentro da empresa.
 */
export const listJoinLinks = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Listar os links abertos de entrada",
    tags: ["invitations"],
  })
  .input(z.object({}))
  .handler(async ({ context, errors }) => {
    if (!(await isOrgAdmin(context.org.id, context.user.id))) {
      throw errors.FORBIDDEN({
        message: "Apenas administradores podem ver os links de convite.",
      });
    }

    const links = await prisma.organizationJoinLink.findMany({
      where: { organizationId: context.org.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        token: true,
        permissions: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    return {
      links: links.map((link) => ({
        id: link.id,
        name: link.name,
        url: buildJoinLink(link.token),
        permissions: link.permissions,
        expiresAt: link.expiresAt?.toISOString() ?? null,
        isExpired: link.expiresAt
          ? link.expiresAt.getTime() < Date.now()
          : false,
        createdAt: link.createdAt.toISOString(),
      })),
    };
  });
