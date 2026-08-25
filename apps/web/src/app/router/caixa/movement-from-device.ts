import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { memberCan } from "@/lib/permissions";
import { z } from "zod";
import { getCaixaMember } from "./_access";

/**
 * Sangria/suprimento OFFLINE (replay do device). Idempotente por
 * `clientOperationId` (o `operationId` do movimento): reenviar após timeout
 * devolve o movimento já criado, sem duplicar. Resolve a sessão pela âncora
 * local `clientSessionId` (tem de existir, ser da org e estar OPEN).
 */
export const cashMovementFromDevice = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      operationId: z.string().min(1),
      clientSessionId: z.string().min(1),
      kind: z.enum(["SANGRIA", "SUPRIMENTO"]),
      amount: z.number().positive(),
      description: z.string().optional(),
    }),
  )
  .output(z.object({ id: z.string(), duplicate: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const orgId = context.org.id;

    // Idempotência.
    const existing = await prisma.cashMovement.findUnique({
      where: { clientOperationId: input.operationId },
      select: { id: true, organizationId: true },
    });
    if (existing) {
      if (existing.organizationId !== orgId) throw errors.FORBIDDEN();
      return { id: existing.id, duplicate: true };
    }

    const member = await getCaixaMember(orgId, context.user.id);
    if (!member)
      throw errors.FORBIDDEN({
        message: "Você não é membro desta organização",
      });
    const action =
      input.kind === "SANGRIA" ? "caixa-sangria" : "caixa-suprimento";
    if (!memberCan(member, action))
      throw errors.FORBIDDEN({
        message: "Você não tem permissão para este movimento de caixa",
      });

    const session = await prisma.cashSession.findUnique({
      where: { clientSessionId: input.clientSessionId },
      select: { id: true, organizationId: true, status: true },
    });
    if (!session || session.organizationId !== orgId)
      throw errors.NOT_FOUND({ message: "Sessão de caixa não encontrada" });
    if (session.status !== "OPEN")
      throw errors.BAD_REQUEST({
        message: "O caixa desta operação já foi fechado",
      });

    try {
      const movement = await prisma.cashMovement.create({
        data: {
          organizationId: orgId,
          sessionId: session.id,
          clientOperationId: input.operationId,
          type: input.kind,
          amount: input.amount,
          description: input.description ?? null,
          createdById: context.user.id,
        },
        select: { id: true },
      });
      return { id: movement.id, duplicate: false };
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code?: string }).code === "P2002"
      ) {
        const winner = await prisma.cashMovement.findUniqueOrThrow({
          where: { clientOperationId: input.operationId },
          select: { id: true },
        });
        return { id: winner.id, duplicate: true };
      }
      throw error;
    }
  });
