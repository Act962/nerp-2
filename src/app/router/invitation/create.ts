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
import {
  INVITABLE_ROLE_VALUES,
  type InvitableRole,
  PAGE_PERMISSION_KEYS,
  roleLabel,
  TRADE_ROLE_VALUES,
  type TradeRoleValue,
} from "@/lib/permissions";
import { APIError } from "better-auth/api";
import z from "zod";

const validKeys = new Set(PAGE_PERMISSION_KEYS);

interface InviteOneParams {
  email: string;
  role: InvitableRole;
  permissions: string[];
  tradeRole: TradeRoleValue | null;
  orgId: string;
  orgName: string;
  inviterName: string;
  inviterEmail: string;
  headers: Headers;
}

// Convida um e-mail e devolve o erro em vez de lançar: num lote, um endereço
// ruim não pode derrubar os demais.
async function inviteOne({
  email,
  role,
  permissions,
  tradeRole,
  orgId,
  orgName,
  inviterName,
  inviterEmail,
  headers,
}: InviteOneParams): Promise<{ id: string } | { reason: string }> {
  const alreadyMember = await prisma.member.findFirst({
    where: { organizationId: orgId, user: { email } },
    select: { id: true },
  });

  if (alreadyMember) {
    return { reason: "já é membro da organização" };
  }

  let invitationId: string;
  let expiresAt: Date;

  try {
    // `resend: true` faz o Better Auth reaproveitar/reenviar um convite
    // pendente para o mesmo e-mail em vez de estourar erro de duplicidade.
    const invitation = await auth.api.createInvitation({
      headers,
      body: { email, role, organizationId: orgId, resend: true },
    });
    invitationId = invitation.id;
    expiresAt = new Date(invitation.expiresAt);
  } catch (error) {
    if (error instanceof APIError) return { reason: error.message };
    throw error;
  }

  await prisma.invitation.update({
    where: { id: invitationId },
    data: { permissions, tradeRole },
  });

  try {
    await sendOrganizationInvitation({
      to: email,
      organizationName: orgName,
      inviterName,
      inviterEmail,
      roleLabel: roleLabel(role),
      inviteLink: buildInvitationLink(invitationId),
      expiresAt,
      // O `expiresAt` entra na chave de propósito. Com `resend: true` o Better
      // Auth reaproveita o convite pendente (mesmo id) e só renova a validade;
      // uma chave apenas com o id se repetiria e o Resend deduplicaria o
      // reconvite dentro de 24h — o admin veria "enviado" sem e-mail nenhum.
      // Assim cada reconvite gera chave nova, mas retries internos de uma
      // mesma chamada (a chave é calculada uma vez) seguem deduplicados.
      idempotencyKey: `organization-invitation/${invitationId}/${expiresAt.getTime()}`,
    });
  } catch (error) {
    // O convite fica pendente na lista; o admin pode reenviar por lá.
    return {
      reason: `convite criado, mas o e-mail falhou (${
        error instanceof Error ? error.message : "erro desconhecido"
      })`,
    };
  }

  return { id: invitationId };
}

export const createInvitation = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Convidar um ou mais membros para a organização",
    tags: ["invitations"],
  })
  .input(
    z.object({
      emails: z
        .array(z.email("Informe um e-mail válido"))
        .min(1, "Adicione ao menos um e-mail")
        .max(20, "No máximo 20 convites por vez"),
      role: z.enum(INVITABLE_ROLE_VALUES),
      permissions: z.array(z.string()).default([]),
      tradeRole: z.enum(TRADE_ROLE_VALUES).nullable().default(null),
    }),
  )
  .output(
    z.object({
      sent: z.array(z.string()),
      failed: z.array(z.object({ email: z.string(), reason: z.string() })),
    }),
  )
  .handler(async ({ context, input, errors }) => {
    if (!(await isOrgAdmin(context.org.id, context.user.id))) {
      throw errors.FORBIDDEN({
        message: "Apenas administradores podem convidar membros.",
      });
    }

    // Admin enxerga tudo, então permissões por página só fazem sentido p/ member.
    const permissions =
      input.role === "member"
        ? Array.from(
            new Set(input.permissions.filter((p) => validKeys.has(p as never))),
          )
        : [];

    const emails = Array.from(
      new Set(input.emails.map((e) => e.trim().toLowerCase())),
    );

    const sent: string[] = [];
    const failed: { email: string; reason: string }[] = [];

    // Sequencial de propósito: o Resend tem rate limit e o lote é curto (<= 20).
    for (const email of emails) {
      const result = await inviteOne({
        email,
        role: input.role,
        permissions,
        tradeRole: input.tradeRole,
        orgId: context.org.id,
        orgName: context.org.name,
        inviterName: context.user.name,
        inviterEmail: context.user.email,
        headers: context.headers,
      });

      if ("reason" in result) {
        failed.push({ email, reason: result.reason });
      } else {
        sent.push(email);
      }
    }

    return { sent, failed };
  });
