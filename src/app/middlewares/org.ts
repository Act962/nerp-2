import { auth } from "@/lib/auth";
import { base } from "./base";

type FullOrganization = NonNullable<
  Awaited<ReturnType<typeof auth.api.getFullOrganization>>
>;

export const requireOrgMiddleware = base.middleware(
  async ({ context, next, errors }) => {
    if (context.isS2S && context.s2sOrg) {
      const org = {
        ...context.s2sOrg,
        members: [],
        invitations: [],
      } as unknown as FullOrganization;
      return next({
        context: { org },
      });
    }

    const organization = await auth.api.getFullOrganization({
      headers: context.headers,
    });

    if (!organization) {
      throw errors.FORBIDDEN();
    }

    // Adds session and user to the context
    return next({
      context: {
        org: organization,
      },
    });
  }
);
