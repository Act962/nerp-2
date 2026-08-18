import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { buildInvitationLink } from "@/lib/email/organization-invitation";
import { isOrgAdmin } from "@/lib/org-access";
import z from "zod";

export const listInvitations = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Listar convites da organização ativa",
    tags: ["invitations"],
  })
  .input(z.object({ status: z.enum(["pending", "all"]).default("pending") }))
  .output(
    z.array(
      z.object({
        id: z.string(),
        email: z.string(),
        role: z.string(),
        status: z.string(),
        permissions: z.array(z.string()),
        expiresAt: z.string(),
        createdAt: z.string(),
        isExpired: z.boolean(),
        inviterName: z.string(),
        // Montado no servidor: o link precisa apontar para a mesma origem do
        // e-mail (o cookie de sessão é host-only), e não para o subdomínio em
        // que o admin por acaso está navegando.
        inviteLink: z.string(),
      }),
    ),
  )
  .handler(async ({ context, input, errors }) => {
    if (!(await isOrgAdmin(context.org.id, context.user.id))) {
      throw errors.FORBIDDEN({
        message: "Apenas administradores podem ver os convites.",
      });
    }

    const invitations = await prisma.invitation.findMany({
      where: {
        organizationId: context.org.id,
        ...(input.status === "pending" ? { status: "pending" } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } } },
    });

    const now = Date.now();

    return invitations.map((invitation) => ({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role ?? "member",
      status: invitation.status,
      permissions: invitation.permissions,
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
      isExpired:
        invitation.status === "pending" && invitation.expiresAt.getTime() < now,
      inviterName: invitation.user.name,
      inviteLink: buildInvitationLink(invitation.id),
    }));
  });
