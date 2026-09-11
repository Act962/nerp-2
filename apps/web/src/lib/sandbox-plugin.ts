import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import {
  lerRespostasDoWizard,
  RESPOSTAS_COOKIE,
} from "@/features/onboarding/lib/respostas";
import { criarSandbox } from "@/features/onboarding/server/criar-sandbox";
import prisma from "./db";

/**
 * Plugin "sandbox": o que acontece em volta do `POST /sign-in/anonymous` do
 * plugin `anonymous` do Better Auth.
 *
 * ANTES: freio por IP. Sem ele, um laço cria contas anônimas — cada uma com
 * organização, dados de exemplo e 50 ★ — até encher o banco. O IP fica na
 * `Session` que o próprio Better Auth grava, então não há tabela nova.
 *
 * DEPOIS: a organização de teste nasce no mesmo request, com as respostas do
 * wizard (nicho e soluções) que a tela guardou num cookie curto. Quem cria é
 * `criarSandbox`, o mesmo caminho da procedure de recuperação
 * `onboarding.criarSandbox`.
 */

export const MAX_CONTAS_ANONIMAS_POR_IP_DIA = 3;

function ipDoContexto(headers: Headers | undefined): string | null {
  if (!headers) return null;
  const encaminhado = headers.get("x-forwarded-for");
  if (encaminhado) return encaminhado.split(",")[0]?.trim() || null;
  return headers.get("x-real-ip");
}

export const sandboxPlugin = () =>
  ({
    id: "sandbox",
    hooks: {
      before: [
        {
          matcher: (ctx) => ctx.path === "/sign-in/anonymous",
          handler: createAuthMiddleware(async (ctx) => {
            const ip = ipDoContexto(ctx.headers);
            if (!ip) return;
            const desde = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const recentes = await prisma.user.count({
              where: {
                isAnonymous: true,
                createdAt: { gte: desde },
                sessions: { some: { ipAddress: ip } },
              },
            });
            if (recentes >= MAX_CONTAS_ANONIMAS_POR_IP_DIA) {
              throw new APIError("TOO_MANY_REQUESTS", {
                message:
                  "Muitas contas de teste criadas deste endereço hoje. Entre com o Google ou tente amanhã.",
              });
            }
          }),
        },
      ],
      after: [
        {
          matcher: (ctx) => ctx.path === "/sign-in/anonymous",
          handler: createAuthMiddleware(async (ctx) => {
            const nova = ctx.context.newSession;
            if (!nova?.user.isAnonymous) return;

            const respostas = lerRespostasDoWizard(
              ctx.getCookie(RESPOSTAS_COOKIE),
            );
            const { organizationId } = await criarSandbox({
              userId: nova.user.id,
              respostas,
            });
            await prisma.session.update({
              where: { id: nova.session.id },
              data: { activeOrganizationId: organizationId },
            });
            // O cookie cumpriu o papel; não fica para uma segunda org.
            ctx.setCookie(RESPOSTAS_COOKIE, "", { maxAge: 0, path: "/" });
          }),
        },
      ],
    },
  }) satisfies BetterAuthPlugin;
