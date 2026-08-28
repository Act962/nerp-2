import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const revokeScannerPairing = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ token: z.string() }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context }) => {
    // updateMany com organizationId: `update` por token encerraria pareamento
    // de outra org.
    await prisma.scannerPairing.updateMany({
      where: { token: input.token, organizationId: context.org.id },
      data: { status: "REVOKED" },
    });
    return { ok: true };
  });
