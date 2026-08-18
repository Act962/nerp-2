import { auth } from "@/lib/auth";
import { base } from "./base";

export const requireAuthMiddleware = base.middleware(
  async ({ context, next, errors }) => {
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
