import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { auth } from "@/lib/auth";
import { enqueueSyncOutbox } from "@/lib/sync-outbox";
import prisma from "@/lib/db";

/**
 * Entra na organização usando o link aberto.
 *
 * Sem `requireOrgMiddleware`: quem entra ainda não é membro de organização
 * alguma — é justamente o que esta rota resolve. Exige estar logado, então a
 * página pública manda para login/cadastro antes e volta para cá.
 *
 * O membro é criado direto no Prisma (e não via plugin) porque o papel e as
 * permissões vêm do link, não de um convite nominal. O `enqueueSyncOutbox` é
 * chamado à mão para replicar o `afterAddMember` do Better Auth — sem ele o
 * membro novo não chegaria ao NASA.
 */
export const acceptJoinLink = base
  .use(requireAuthMiddleware)
  .route({
    method: "POST",
    summary: "Entrar na organização por link aberto",
    tags: ["invitations"],
  })
  .input(z.object({ token: z.string().min(8) }))
  .output(z.object({ organizationId: z.string(), alreadyMember: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const link = await prisma.organizationJoinLink.findUnique({
      where: { token: input.token },
      select: {
        role: true,
        permissions: true,
        expiresAt: true,
        organizationId: true,
        organization: { select: { maxUsers: true } },
      },
    });

    if (!link || (link.expiresAt && link.expiresAt.getTime() < Date.now())) {
      throw errors.NOT_FOUND({ message: "Link inválido ou expirado." });
    }

    const organizationId = link.organizationId;

    // Já é membro: não duplica nem sobrescreve as permissões que ele já tem
    // (podem ter sido ajustadas depois). Só ativa a org e segue.
    const existing = await prisma.member.findFirst({
      where: { organizationId, userId: context.user.id },
      select: { id: true },
    });

    if (!existing) {
      // Limite de usuários do plano. Existe no schema desde sempre e nunca foi
      // aplicado — um link aberto é justamente o caminho por onde a conta
      // estouraria o plano sem ninguém perceber.
      const total = await prisma.member.count({ where: { organizationId } });
      if (total >= link.organization.maxUsers) {
        throw errors.BAD_REQUEST({
          message:
            "Esta empresa atingiu o limite de usuários do plano. Fale com o administrador.",
        });
      }

      const member = await prisma.member.create({
        data: {
          organizationId,
          userId: context.user.id,
          role: link.role,
          permissions: link.permissions,
        },
        select: {
          id: true,
          organizationId: true,
          userId: true,
          role: true,
          createdAt: true,
        },
      });

      await enqueueSyncOutbox("member", {
        id: member.id,
        organizationId: member.organizationId,
        userId: member.userId,
        role: member.role,
        createdAt: member.createdAt.toISOString(),
      });
    }

    // Deixa a org ativa para o usuário cair direto nela.
    await auth.api.setActiveOrganization({
      headers: context.headers,
      body: { organizationId },
    });

    return { organizationId, alreadyMember: Boolean(existing) };
  });
