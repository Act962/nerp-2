import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { isOrgAdmin } from "@/lib/org-access";
import { TRADE_ROLE_VALUES } from "@/lib/permissions";
import z from "zod";

// Cargo no Trade (coordenação/supervisão). Grava direto no Prisma, não pelo
// Better Auth: `Member.role` continua sendo o cargo de ACESSO e é o Better Auth
// quem manda nele — este campo é função de campo e vive ao lado.
export const updateMemberTradeRole = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      memberId: z.string(),
      tradeRole: z.enum(TRADE_ROLE_VALUES).nullable(),
    }),
  )
  .output(z.object({ success: z.literal(true) }))
  .handler(async ({ context, input, errors }) => {
    if (!(await isOrgAdmin(context.org.id, context.user.id))) {
      throw errors.FORBIDDEN({
        message: "Apenas administradores podem alterar o cargo no Trade.",
      });
    }

    const member = await prisma.member.findFirst({
      where: { id: input.memberId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!member) throw errors.NOT_FOUND({ message: "Membro não encontrado." });

    await prisma.member.update({
      where: { id: member.id },
      data: { tradeRole: input.tradeRole },
    });

    return { success: true as const };
  });
