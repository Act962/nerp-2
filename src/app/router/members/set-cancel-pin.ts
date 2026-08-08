import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import bcrypt from "bcrypt";
import { z } from "zod";

// Define/limpa o PIN pessoal de autorização de cancelamento do membro atual.
// Guardado como hash bcrypt; `null` remove o PIN.
export const setMemberCancelPin = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      pin: z
        .string()
        .regex(/^\d{4,6}$/, "O PIN deve ter de 4 a 6 dígitos")
        .nullable(),
    }),
  )
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context }) => {
    const hash = input.pin ? await bcrypt.hash(input.pin, 10) : null;
    await prisma.member.updateMany({
      where: { organizationId: context.org.id, userId: context.user.id },
      data: { cancelPinHash: hash },
    });
    return { ok: true };
  });
