import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { isOrgAdmin } from "@/lib/org-access";
import { APIError } from "better-auth/api";
import z from "zod";

export const removeMember = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Remover um membro da organização",
    tags: ["members"],
  })
  .input(z.object({ memberId: z.string() }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ context, input, errors }) => {
    if (!(await isOrgAdmin(context.org.id, context.user.id))) {
      throw errors.FORBIDDEN({
        message: "Apenas administradores podem remover membros.",
      });
    }

    const member = await prisma.member.findFirst({
      where: { id: input.memberId, organizationId: context.org.id },
      select: { userId: true, role: true },
    });

    if (!member) {
      throw errors.NOT_FOUND({ message: "Membro não encontrado." });
    }

    if (member.userId === context.user.id) {
      throw errors.BAD_REQUEST({
        message: "Você não pode remover a si mesmo da organização.",
      });
    }

    if (member.role === "owner") {
      throw errors.FORBIDDEN({
        message: "O dono da organização não pode ser removido.",
      });
    }

    try {
      await auth.api.removeMember({
        headers: context.headers,
        body: {
          memberIdOrEmail: input.memberId,
          organizationId: context.org.id,
        },
      });
    } catch (error) {
      if (error instanceof APIError) {
        throw errors.BAD_REQUEST({ message: error.message });
      }
      throw error;
    }

    return { success: true };
  });
