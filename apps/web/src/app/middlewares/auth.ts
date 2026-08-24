import { auth } from "@/lib/auth";
import { deviceCanAccess } from "@/lib/device-scopes";
import { base } from "./base";

export const requireAuthMiddleware = base.middleware(
  async ({ context, next, errors, path }) => {
    if (context.isDevice && context.deviceUser && context.deviceOrg) {
      // Autorização do terminal: fail-closed. O bearer de device só alcança as
      // procedures listadas em `device-scopes.ts` e para as quais ele tem o
      // escopo — sem isto, o token vale como o login inteiro do operador.
      if (!deviceCanAccess(path, context.deviceScopes ?? [])) {
        throw errors.FORBIDDEN({
          message: "Este dispositivo não tem permissão para esta operação",
        });
      }

      const now = new Date();
      const session = {
        id: `device-${context.deviceOrg.id}`,
        token: "device",
        userId: context.deviceUser.id,
        activeOrganizationId: context.deviceOrg.id,
        ipAddress: null,
        userAgent: null,
        expiresAt: new Date(now.getTime() + 60 * 1000),
        createdAt: now,
        updatedAt: now,
      };
      return next({
        context: {
          session,
          user: context.deviceUser,
        },
      });
    }

    if (context.isS2S && context.s2sUser && context.s2sOrg) {
      const now = new Date();
      const session = {
        id: `s2s-${context.s2sOrg.id}`,
        token: "s2s",
        userId: context.s2sUser.id,
        activeOrganizationId: context.s2sOrg.id,
        ipAddress: null,
        userAgent: null,
        expiresAt: new Date(now.getTime() + 60 * 1000),
        createdAt: now,
        updatedAt: now,
      };
      return next({
        context: {
          session,
          user: context.s2sUser,
        },
      });
    }

    const sessionData = await auth.api.getSession({
      headers: context.headers,
    });

    if (!sessionData?.session || !sessionData?.user) {
      throw errors.UNAUTHORIZED();
    }

    // Adds session and user to the context
    return next({
      context: {
        session: sessionData.session,
        user: sessionData.user,
      },
    });
  },
);
