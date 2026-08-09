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
      select: {
        id: true,
        status: true,
        expiresAt: true,
        pinAttempts: true,
        requestedById: true,
      },
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

    // Trava durável contra brute-force do PIN: o cap por-solicitação (5 acima) é
    // resetável criando novas solicitações. Somamos as tentativas erradas do
    // MESMO solicitante numa janela de 15 min — algo que o atacante não zera
    // gerando solicitações novas. Sem isso, um caixa forjaria a autorização de
    // um supervisor por força bruta num PIN de 4 dígitos.
    const WINDOW_MS = 15 * 60 * 1000;
    const MAX_ATTEMPTS_PER_WINDOW = 10;
    const windowStart = new Date(Date.now() - WINDOW_MS);
    const recent = await prisma.cancellationRequest.aggregate({
      where: {
        organizationId: context.org.id,
        requestedById: request.requestedById,
        createdAt: { gte: windowStart },
      },
      _sum: { pinAttempts: true },
    });
    if ((recent._sum?.pinAttempts ?? 0) >= MAX_ATTEMPTS_PER_WINDOW)
      throw errors.FORBIDDEN({
        message:
          "Muitas tentativas de PIN. Aguarde alguns minutos antes de tentar de novo.",
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
