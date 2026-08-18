import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import { z } from "zod";
import { isAuthorizer } from "./_access";

// Autorizador (pelo celular) recusa a solicitação.
export const rejectCancelRequest = base
  .use(requireAuthMiddleware)
  .input(z.object({ token: z.string() }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const request = await prisma.cancellationRequest.findFirst({
      where: { token: input.token },
      select: { id: true, status: true, organizationId: true },
    });
    if (!request)
      throw errors.NOT_FOUND({ message: "Solicitação não encontrada" });

    const member = await prisma.member.findFirst({
      where: {
        organizationId: request.organizationId,
        userId: context.user.id,
      },
      select: { role: true, permissions: true },
    });
    if (!isAuthorizer(member))
      throw errors.FORBIDDEN({ message: "Sem permissão" });

    if (request.status === "PENDING") {
      await prisma.cancellationRequest.update({
        where: { id: request.id },
        data: { status: "REJECTED" },
      });
    }
    return { ok: true };
  });
