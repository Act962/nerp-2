import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import { z } from "zod";
import { isAuthorizer } from "./_access";

// Tela de aprovação no celular: mostra os detalhes da solicitação para um
// autorizador da org (resolvida pelo token).
export const getCancelRequestByToken = base
  .use(requireAuthMiddleware)
  .input(z.object({ token: z.string() }))
  .output(
    z.object({
      status: z.enum(["PENDING", "APPROVED", "REJECTED", "EXPIRED"]),
      kind: z.enum(["REMOVE_ITEM", "REDUCE_QTY"]),
      productName: z.string(),
      quantity: z.number(),
      amount: z.number(),
      reason: z.string().nullable(),
      requestedByName: z.string(),
      orgName: z.string(),
      canAuthorize: z.boolean(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const request = await prisma.cancellationRequest.findFirst({
      where: { token: input.token },
      select: {
        status: true,
        kind: true,
        productName: true,
        quantity: true,
        amount: true,
        reason: true,
        organizationId: true,
        requestedBy: { select: { name: true } },
        organization: { select: { name: true } },
      },
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

    return {
      status: request.status,
      kind: request.kind,
      productName: request.productName,
      quantity: Number(request.quantity),
      amount: Number(request.amount),
      reason: request.reason,
      requestedByName: request.requestedBy.name,
      orgName: request.organization.name,
      canAuthorize: isAuthorizer(member),
    };
  });
