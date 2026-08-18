import { createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import type { BetterAuthPlugin } from "better-auth";
import { z } from "zod";
import prisma from "./db";
import { verifyCrossLoginToken } from "./cross-login";

/**
 * Plugin "cross-login": permite que o NASA logue um usuário no NERP sem
 * credenciais, via um token assinado (HMAC `SYNC_SHARED_SECRET`, TTL curto).
 *
 * Endpoint: GET /api/auth/cross-login?token=...
 * Como os cookies do better-auth são assinados com o secret, NÃO dá pra setar
 * o cookie na mão — criamos a sessão pela API interna do better-auth
 * (`internalAdapter.createSession` + `setSessionCookie`), que assinam certo.
 * O acesso é por navegação top-level (nova aba), pra o cookie colar no domínio.
 */
export const crossLoginPlugin = () =>
  ({
    id: "cross-login",
    endpoints: {
      crossLogin: createAuthEndpoint(
        "/cross-login",
        {
          method: "GET",
          query: z.object({ token: z.string() }),
        },
        async (ctx) => {
          const verified = verifyCrossLoginToken(ctx.query.token);
          if (!verified) {
            throw ctx.redirect("/login?error=invalid_cross_login");
          }

          const user = await prisma.user.findUnique({
            where: { id: verified.userId },
          });
          if (!user) {
            throw ctx.redirect("/login?error=cross_login_user_not_found");
          }

          const session = await ctx.context.internalAdapter.createSession(
            user.id,
          );
          if (!session) {
            throw ctx.redirect("/login?error=cross_login_session_failed");
          }

          // NERP não tem hook de session.create — setamos a org ativa aqui
          // (primeira membership do usuário, se houver).
          const member = await prisma.member.findFirst({
            where: { userId: user.id },
            select: { organizationId: true },
          });
          if (member) {
            await prisma.session.update({
              where: { id: session.id },
              data: { activeOrganizationId: member.organizationId },
            });
          }

          await setSessionCookie(ctx, { session, user });
          throw ctx.redirect("/");
        },
      ),
    },
  }) satisfies BetterAuthPlugin;
