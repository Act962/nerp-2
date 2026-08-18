import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { requireOrgAdmin } from "@/lib/org-access";
import { z } from "zod";

// Liga/desliga a exigência de autorização para cancelar/reduzir item no PDV.
export const updateRequireCancelAuth = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ require: z.boolean() }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context }) => {
    await requireOrgAdmin(context.org.id, context.user.id);
    await prisma.organization.update({
      where: { id: context.org.id },
      data: { requireCancelAuth: input.require },
    });
    return { ok: true };
  });
