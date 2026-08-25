import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { isOrgAdmin } from "@/lib/org-access";
import { APIError } from "better-auth/api";
import z from "zod";

export const cancelInvitation = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Cancelar um convite pendente",
    tags: ["invitations"],
  })
  .input(z.object({ invitationId: z.string() }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ context, input, errors }) => {
    if (!(await isOrgAdmin(context.org.id, context.user.id))) {
      throw errors.FORBIDDEN({
        message: "Apenas administradores podem cancelar convites.",
      });
    }

    const invitation = await prisma.invitation.findFirst({
      where: { id: input.invitationId, organizationId: context.org.id },
      select: { id: true },
    });

    if (!invitation) {
      throw errors.NOT_FOUND({ message: "Convite não encontrado." });
    }

    try {
      await auth.api.cancelInvitation({
        headers: context.headers,
        body: { invitationId: input.invitationId },
      });
    } catch (error) {
      if (error instanceof APIError) {
        throw errors.BAD_REQUEST({ message: error.message });
      }
      throw error;
    }

    return { success: true };
  });
