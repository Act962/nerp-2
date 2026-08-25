import "server-only";

import { getResend, organizationFrom } from "./client";

interface OrganizationInvitationEmail {
  to: string;
  organizationName: string;
  inviterName: string;
  inviterEmail: string;
  roleLabel: string;
  inviteLink: string;
  expiresAt: Date;
  /**
   * Padrão `<evento>/<id>` recomendado pelo Resend. Vale por 24h: um retry com
   * a mesma chave não dispara outro e-mail. Só use onde reenviar é acidente
   * (duplo-clique); o reenvio manual precisa sair sem chave.
   */
  idempotencyKey?: string;
}

// Mesma origem usada pelo Better Auth: o cookie de sessão é host-only, então o
// aceite precisa acontecer no host que emitiu a sessão.
export function buildInvitationLink(invitationId: string): string {
  const baseOrigin = (
    process.env.BETTER_AUTH_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");
  return `${baseOrigin}/accept-invitation/${invitationId}`;
}

// Nome/e-mail vêm de input do usuário e são interpolados no HTML do e-mail.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatExpiry(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function buildHtml({
  organizationName,
  inviterName,
  inviterEmail,
  roleLabel,
  inviteLink,
  expiresAt,
}: Omit<OrganizationInvitationEmail, "to" | "idempotencyKey">): string {
  const org = escapeHtml(organizationName);
  const inviter = escapeHtml(inviterName);
  const email = escapeHtml(inviterEmail);
  const role = escapeHtml(roleLabel);

  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:24px;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:12px;border:1px solid #e4e4e7;">
            <tr>
              <td style="padding:32px 32px 24px 32px;">
                <h1 style="margin:0 0 16px 0;font-size:20px;line-height:28px;color:#18181b;font-weight:600;">
                  Você foi convidado para ${org}
                </h1>
                <p style="margin:0 0 8px 0;font-size:14px;line-height:22px;color:#52525b;">
                  <strong style="color:#18181b;">${inviter}</strong> (${email}) convidou você para participar da organização
                  <strong style="color:#18181b;">${org}</strong> como <strong style="color:#18181b;">${role}</strong>.
                </p>
                <p style="margin:0 0 24px 0;font-size:14px;line-height:22px;color:#52525b;">
                  Este convite expira em ${formatExpiry(expiresAt)}.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-radius:8px;background-color:#18181b;">
                      <a href="${inviteLink}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:500;color:#ffffff;text-decoration:none;border-radius:8px;">
                        Aceitar convite
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:24px 0 0 0;font-size:12px;line-height:20px;color:#71717a;">
                  Se o botão não funcionar, copie e cole este endereço no navegador:<br />
                  <a href="${inviteLink}" style="color:#3f3f46;word-break:break-all;">${inviteLink}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 24px 32px;border-top:1px solid #e4e4e7;">
                <p style="margin:0;font-size:12px;line-height:20px;color:#a1a1aa;">
                  Se você não esperava este convite, pode ignorar este e-mail com segurança.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendOrganizationInvitation({
  to,
  idempotencyKey,
  ...content
}: OrganizationInvitationEmail): Promise<void> {
  const { error } = await getResend().emails.send(
    {
      from: organizationFrom(),
      to,
      subject: `${content.inviterName} convidou você para ${content.organizationName}`,
      html: buildHtml(content),
      text: [
        `${content.inviterName} (${content.inviterEmail}) convidou você para participar da organização ${content.organizationName} como ${content.roleLabel}.`,
        "",
        `Aceitar convite: ${content.inviteLink}`,
        "",
        `Este convite expira em ${formatExpiry(content.expiresAt)}.`,
      ].join("\n"),
    },
    idempotencyKey ? { idempotencyKey } : undefined,
  );

  // O SDK do Resend devolve erro no payload em vez de lançar.
  if (error) {
    throw new Error(`Falha ao enviar convite para ${to}: ${error.message}`);
  }
}
