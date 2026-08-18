import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { isOrgAdmin } from "@/lib/org-access";
import { INVITABLE_ROLE_VALUES } from "@/lib/permissions";
import { APIError } from "better-auth/api";
import z from "zod";

export const updateMemberRole = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Alterar o cargo de um membro",
    tags: ["members"],
  })
  .input(
    z.object({
      memberId: z.string(),
      role: z.enum(INVITABLE_ROLE_VALUES),
    }),
  )
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ context, input, errors }) => {
    if (!(await isOrgAdmin(context.org.id, context.user.id))) {
      throw errors.FORBIDDEN({
        message: "Apenas administradores podem alterar cargos.",
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
        message: "Você não pode alterar o seu próprio cargo.",
      });
    }

    if (member.role === "owner") {
      throw errors.FORBIDDEN({
        message: "O cargo do dono da organização não pode ser alterado.",
      });
    }

    try {
      await auth.api.updateMemberRole({
        headers: context.headers,
        body: {
          memberId: input.memberId,
          role: input.role,
          organizationId: context.org.id,
        },
      });
    } catch (error) {
      if (error instanceof APIError) {
        throw errors.BAD_REQUEST({ message: error.message });
      }
      throw error;
    }

    // Admin vê tudo; permissões por página deixam de fazer sentido.
    if (input.role !== "member") {
      await prisma.member.update({
        where: { id: input.memberId },
        data: { permissions: [] },
      });
    }

    return { success: true };
  });
