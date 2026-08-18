import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { buildJoinLink, generateJoinToken } from "@/lib/join-link";
import { isOrgAdmin } from "@/lib/org-access";
import { PAGE_PERMISSION_KEYS } from "@/lib/permissions";

/**
 * Cria um link novo ou edita um existente.
 *
 * Sem `id` cria; com `id` atualiza nome, páginas e prazo SEM trocar o token —
 * corrigir um nome errado não pode invalidar a URL que já foi distribuída.
 * Para invalidar existe o `regenerate`, que é uma decisão à parte.
 */
export const saveJoinLink = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Criar ou editar um link aberto de entrada",
    tags: ["invitations"],
  })
  .input(
    z.object({
      id: z.string().optional(),
      name: z.string().trim().min(1, "Dê um nome ao link").max(60),
      /** Páginas que o novo membro passa a enxergar. */
      permissions: z.array(z.string()).default([]),
      /** Dias até expirar. Ausente = sem prazo, vale até revogar. */
      expiresInDays: z.number().int().min(1).max(365).nullable().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    if (!(await isOrgAdmin(context.org.id, context.user.id))) {
      throw errors.FORBIDDEN({
        message: "Apenas administradores podem gerar links de convite.",
      });
    }

    // Só chaves conhecidas: string solta viraria permissão fantasma que
    // ninguém consegue revisar depois na tela de permissões.
    const permissions = input.permissions.filter((key) =>
      (PAGE_PERMISSION_KEYS as readonly string[]).includes(key),
    );
    const expiresAt = input.expiresInDays
      ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    if (input.id) {
      const existing = await prisma.organizationJoinLink.findFirst({
        where: { id: input.id, organizationId: context.org.id },
        select: { id: true },
      });
      if (!existing) {
        throw errors.NOT_FOUND({ message: "Link não encontrado." });
      }

      const link = await prisma.organizationJoinLink.update({
        where: { id: existing.id },
        data: { name: input.name, permissions, expiresAt },
        select: { id: true, token: true },
      });
      return { id: link.id, url: buildJoinLink(link.token) };
    }

    const link = await prisma.organizationJoinLink.create({
      data: {
        organizationId: context.org.id,
        name: input.name,
        token: generateJoinToken(),
        permissions,
        expiresAt,
        createdById: context.user.id,
      },
      select: { id: true, token: true },
    });

    return { id: link.id, url: buildJoinLink(link.token) };
  });
