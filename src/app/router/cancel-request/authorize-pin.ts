import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import bcrypt from "bcrypt";
import { z } from "zod";
import { isAuthorizer } from "./_access";

// Autoriza pela tela do PDV: o supervisor digita o PIN pessoal. O PIN identifica
// QUALQUER autorizador da org (owner/admin ou permissão), então basta um deles
// digitar o próprio PIN no balcão.
export const authorizeCancelByPin = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ requestId: z.string(), pin: z.string().min(1) }))
  .output(z.object({ ok: z.boolean(), approvedByName: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const request = await prisma.cancellationRequest.findFirst({
      where: { id: input.requestId, organizationId: context.org.id },
      select: { id: true, status: true, expiresAt: true, pinAttempts: true },
    });
    if (!request)
      throw errors.NOT_FOUND({ message: "Solicitação não encontrada" });
    if (request.status !== "PENDING")
      throw errors.BAD_REQUEST({ message: "Solicitação já resolvida" });
    if (request.expiresAt < new Date()) {
      await prisma.cancellationRequest.update({
        where: { id: request.id },
        data: { status: "EXPIRED" },
      });
      throw errors.BAD_REQUEST({ message: "Solicitação expirada" });
    }
    if (request.pinAttempts >= 5)
      throw errors.BAD_REQUEST({
        message: "Muitas tentativas. Gere uma nova solicitação.",
      });

    const candidates = await prisma.member.findMany({
      where: {
        organizationId: context.org.id,
        cancelPinHash: { not: null },
      },
      select: {
        userId: true,
        role: true,
        permissions: true,
        cancelPinHash: true,
        user: { select: { name: true } },
      },
    });

    let approver: { userId: string; name: string } | null = null;
    for (const member of candidates) {
      if (!isAuthorizer(member) || !member.cancelPinHash) continue;
      if (await bcrypt.compare(input.pin, member.cancelPinHash)) {
        approver = { userId: member.userId, name: member.user.name };
        break;
      }
    }

    if (!approver) {
      await prisma.cancellationRequest.update({
        where: { id: request.id },
        data: { pinAttempts: { increment: 1 } },
      });
      throw errors.FORBIDDEN({
        message: "PIN inválido ou sem permissão para autorizar",
      });
    }

    await prisma.cancellationRequest.update({
      where: { id: request.id },
      data: {
        status: "APPROVED",
        approvedById: approver.userId,
        approvedByName: approver.name,
        approvedAt: new Date(),
      },
    });
    return { ok: true, approvedByName: approver.name };
  });
