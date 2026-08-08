import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { randomUUID } from "node:crypto";
import { z } from "zod";

// Caixa solicita a autorização de uma remoção/redução. Gera token (QR) e fica
// PENDING até um autorizador aprovar (PIN na tela ou QR no celular).
export const createCancelRequest = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      kind: z.enum(["REMOVE_ITEM", "REDUCE_QTY"]),
      productName: z.string().min(1),
      quantity: z.number().positive(),
      unitPrice: z.number().min(0),
      amount: z.number().min(0),
      reason: z.string().optional(),
      cashSessionId: z.string().optional(),
    }),
  )
  .output(z.object({ id: z.string(), token: z.string() }))
  .handler(async ({ input, context }) => {
    const token = randomUUID();
    const request = await prisma.cancellationRequest.create({
      data: {
        organizationId: context.org.id,
        cashSessionId: input.cashSessionId ?? null,
        requestedById: context.user.id,
        kind: input.kind,
        productName: input.productName,
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        amount: input.amount,
        reason: input.reason ?? null,
        token,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
      select: { id: true, token: true },
    });
    return request;
  });
