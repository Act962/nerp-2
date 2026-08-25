import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Liga/desliga a vitrine pública TradeGram (/tradegram/<slug>). Opt-in por org:
// enquanto false, as procedures públicas respondem NOT_FOUND.
export const updateOrgPublicProfile = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ isPublicProfile: z.boolean() }))
  .output(z.object({ isPublicProfile: z.boolean() }))
  .handler(async ({ input, context }) => {
    const organization = await prisma.organization.update({
      where: { id: context.org.id },
      data: { isPublicProfile: input.isPublicProfile },
      select: { isPublicProfile: true },
    });
    return { isPublicProfile: organization.isPublicProfile };
  });
