import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import { z } from "zod";
import { isAuthorizer } from "./_access";

// Aprovação pelo celular (QR): resolve a org PELO TOKEN (o autorizador pode ter
// outra org ativa), e exige que o usuário seja autorizador daquela org.
export const authorizeCancelByToken = base
  .use(requireAuthMiddleware)
  .input(z.object({ token: z.string() }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const request = await prisma.cancellationRequest.findFirst({
      where: { token: input.token },
      select: { id: true, status: true, expiresAt: true, organizationId: true },
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
      throw errors.FORBIDDEN({
        message: "Você não pode autorizar cancelamentos desta loja",
      });

    if (request.status !== "PENDING")
      throw errors.BAD_REQUEST({ message: "Solicitação já resolvida" });
    if (request.expiresAt < new Date()) {
      await prisma.cancellationRequest.update({
        where: { id: request.id },
        data: { status: "EXPIRED" },
      });
      throw errors.BAD_REQUEST({ message: "Solicitação expirada" });
    }

    await prisma.cancellationRequest.update({
      where: { id: request.id },
      data: {
        status: "APPROVED",
        approvedById: context.user.id,
        approvedByName: context.user.name ?? "Autorizador",
        approvedAt: new Date(),
      },
    });
    return { ok: true };
  });
