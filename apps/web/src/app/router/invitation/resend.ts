import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import {
  buildInvitationLink,
  sendOrganizationInvitation,
} from "@/lib/email/organization-invitation";
import { isOrgAdmin } from "@/lib/org-access";
import { roleLabel, toInvitableRole } from "@/lib/permissions";
import { APIError } from "better-auth/api";
import z from "zod";

export const resendInvitation = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Reenviar o e-mail de um convite pendente",
    tags: ["invitations"],
  })
  .input(z.object({ invitationId: z.string() }))
  .output(z.object({ id: z.string() }))
  .handler(async ({ context, input, errors }) => {
    if (!(await isOrgAdmin(context.org.id, context.user.id))) {
      throw errors.FORBIDDEN({
        message: "Apenas administradores podem reenviar convites.",
      });
    }

    const invitation = await prisma.invitation.findFirst({
      where: { id: input.invitationId, organizationId: context.org.id },
      select: { email: true, role: true, permissions: true, status: true },
    });

    if (!invitation) {
      throw errors.NOT_FOUND({ message: "Convite não encontrado." });
    }

    if (invitation.status !== "pending") {
      throw errors.BAD_REQUEST({
        message: "Só é possível reenviar convites pendentes.",
      });
    }

    const role = toInvitableRole(invitation.role);

    let invitationId: string;
    let expiresAt: Date;

    try {
      const resent = await auth.api.createInvitation({
        headers: context.headers,
        body: {
          email: invitation.email,
          role,
          organizationId: context.org.id,
          resend: true,
        },
      });
      invitationId = resent.id;
      expiresAt = new Date(resent.expiresAt);
    } catch (error) {
      if (error instanceof APIError) {
        throw errors.BAD_REQUEST({ message: error.message });
      }
      throw error;
    }

    // O reenvio pode gerar um novo registro; as permissões acompanham o convite.
    if (invitationId !== input.invitationId) {
      await prisma.invitation.update({
        where: { id: invitationId },
        data: { permissions: invitation.permissions },
      });
    }

    try {
      // Sem idempotencyKey: reenviar é a intenção explícita do admin — uma
      // chave faria o segundo pedido dentro de 24h virar no-op silencioso.
      await sendOrganizationInvitation({
        to: invitation.email,
        organizationName: context.org.name,
        inviterName: context.user.name,
        inviterEmail: context.user.email,
        roleLabel: roleLabel(role),
        inviteLink: buildInvitationLink(invitationId),
        expiresAt,
      });
    } catch (error) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: `Não foi possível enviar o e-mail: ${
          error instanceof Error ? error.message : "erro desconhecido"
        }`,
      });
    }

    return { id: invitationId };
  });
