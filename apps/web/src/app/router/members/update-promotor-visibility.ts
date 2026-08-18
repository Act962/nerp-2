import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { isOrgAdmin } from "@/lib/org-access";
import z from "zod";

// Liga/desliga o nome do membro nas informações carimbadas na foto do promotor.
export const updateMemberPromotorVisibility = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ memberId: z.string(), visible: z.boolean() }))
  .output(z.object({ success: z.literal(true) }))
  .handler(async ({ context, input, errors }) => {
    if (!(await isOrgAdmin(context.org.id, context.user.id))) {
      throw errors.FORBIDDEN({
        message: "Apenas administradores podem alterar esta opção.",
      });
    }

    const member = await prisma.member.findFirst({
      where: { id: input.memberId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!member) throw errors.NOT_FOUND({ message: "Membro não encontrado." });

    await prisma.member.update({
      where: { id: member.id },
      data: { showInPromotorPhoto: input.visible },
    });

    return { success: true as const };
  });
