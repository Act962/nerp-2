import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { buildJoinLink, generateJoinToken } from "@/lib/join-link";
import { isOrgAdmin } from "@/lib/org-access";
import { PAGE_PERMISSION_KEYS } from "@/lib/permissions";
import prisma from "@/lib/db";

/**
 * Cria, regenera ou desliga o link aberto de entrada.
 *
 * `enable: false` APAGA a linha — o link antigo deixa de existir na hora.
 * `enable: true` sempre gera um token novo, então "regenerar" invalida todos
 * os links que já circularam. É a única forma de revogar algo que pode ter
 * sido encaminhado para qualquer lugar.
 */
export const rotateJoinLink = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Gerar ou revogar o link aberto de entrada",
    tags: ["invitations"],
  })
  .input(
    z.object({
      enable: z.boolean(),
      /** Páginas que o novo membro passa a enxergar. */
      permissions: z.array(z.string()).default([]),
      /** Dias até expirar. Ausente = sem prazo, vale até revogar. */
      expiresInDays: z.number().int().min(1).max(365).optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    if (!(await isOrgAdmin(context.org.id, context.user.id))) {
      throw errors.FORBIDDEN({
        message: "Apenas administradores podem gerar o link de convite.",
      });
    }

    if (!input.enable) {
      await prisma.organizationJoinLink.deleteMany({
        where: { organizationId: context.org.id },
      });
      return { link: null };
    }

    // Só chaves conhecidas: string solta viraria permissão fantasma que
    // ninguém consegue revisar depois na tela de permissões.
    const permissions = input.permissions.filter((key) =>
      (PAGE_PERMISSION_KEYS as readonly string[]).includes(key),
    );
    const token = generateJoinToken();
    const expiresAt = input.expiresInDays
      ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const link = await prisma.organizationJoinLink.upsert({
      where: { organizationId: context.org.id },
      create: {
        organizationId: context.org.id,
        token,
        permissions,
        expiresAt,
        createdById: context.user.id,
      },
      update: { token, permissions, expiresAt, createdById: context.user.id },
      select: { token: true, permissions: true, expiresAt: true },
    });

    return {
      link: {
        url: buildJoinLink(link.token),
        permissions: link.permissions,
        expiresAt: link.expiresAt?.toISOString() ?? null,
      },
    };
  });
