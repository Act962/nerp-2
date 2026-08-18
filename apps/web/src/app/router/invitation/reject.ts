import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { auth } from "@/lib/auth";
import { APIError } from "better-auth/api";
import z from "zod";

export const rejectInvitation = base
  .use(requireAuthMiddleware)
  .route({
    method: "POST",
    summary: "Recusar um convite",
    tags: ["invitations"],
  })
  .input(z.object({ invitationId: z.string() }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ context, input, errors }) => {
    try {
      await auth.api.rejectInvitation({
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
