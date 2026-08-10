import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { requireOrgAdmin } from "@/lib/org-access";
import { z } from "zod";

const configSchema = z.object({
  enabled: z.boolean(),
  prefix: z.string().max(3),
  kind: z.enum(["PRICE", "WEIGHT"]),
  codeStart: z.number().int().min(0).max(12),
  codeLength: z.number().int().min(1).max(12),
  valueStart: z.number().int().min(0).max(12),
  valueLength: z.number().int().min(1).max(12),
  valueDecimals: z.number().int().min(0).max(4),
});

// Só o admin edita o layout do código pesável (afeta o PDV de toda a org).
export const updatePdvWeighed = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ config: configSchema }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context }) => {
    await requireOrgAdmin(context.org.id, context.user.id);
    await prisma.organization.update({
      where: { id: context.org.id },
      data: { pdvWeighedBarcode: input.config },
    });
    return { ok: true };
  });
