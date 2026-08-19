import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { memberCan } from "@/lib/permissions";
import { z } from "zod";
import { getCaixaMember } from "./_access";

/**
 * Abertura de caixa OFFLINE (replay do device).
 *
 * Idempotente por `clientSessionId` (o `operationId` do "abrir" no device):
 * reenviar após timeout devolve a sessão já criada (`duplicate`), sem abrir
 * outra. O caixa físico (`CashRegister`) é DERIVADO do device — find-or-create
 * por nome — então cada terminal tem o seu, sem UI de seleção nem colisão "1 OPEN
 * por register". O operador é o usuário pareado (`context.user`), gravado em
 * `openedById` (identidade plugável — trocar para PIN depois não remexe aqui).
 */
export const openCaixaFromDevice = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      operationId: z.string().min(1),
      openingBalance: z.number().min(0),
      registerName: z.string().min(1),
      openedAt: z.string().optional(), // ISO do momento offline
      openingNotes: z.string().optional(),
    }),
  )
  .output(
    z.object({
      sessionId: z.string(),
      openedAt: z.string(),
      duplicate: z.boolean(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const orgId = context.org.id;

    // Idempotência: já aberto por esse operationId?
    const existing = await prisma.cashSession.findUnique({
      where: { clientSessionId: input.operationId },
      select: { id: true, openedAt: true, organizationId: true },
    });
    if (existing) {
      if (existing.organizationId !== orgId) throw errors.FORBIDDEN();
      return {
        sessionId: existing.id,
        openedAt: existing.openedAt.toISOString(),
        duplicate: true,
      };
    }

    const member = await getCaixaMember(orgId, context.user.id);
    if (!member)
      throw errors.FORBIDDEN({
        message: "Você não é membro desta organização",
      });
    if (!memberCan(member, "caixa-abrir"))
      throw errors.FORBIDDEN({
        message: "Você não tem permissão para abrir o caixa",
      });

    // Caixa físico derivado do device (find-or-create ativo por nome).
    const existingRegister = await prisma.cashRegister.findFirst({
      where: { organizationId: orgId, name: input.registerName },
      select: { id: true },
    });
    const register =
      existingRegister ??
      (await prisma.cashRegister.create({
        data: { organizationId: orgId, name: input.registerName },
        select: { id: true },
      }));

    const openedAt = input.openedAt ? new Date(input.openedAt) : new Date();

    try {
      const session = await prisma.$transaction(async (tx) => {
        const openMember = await tx.cashSession.findFirst({
          where: { organizationId: orgId, memberId: member.id, status: "OPEN" },
          select: { id: true },
        });
        if (openMember)
          throw errors.BAD_REQUEST({ message: "Você já tem um caixa aberto." });
        const openReg = await tx.cashSession.findFirst({
          where: {
            organizationId: orgId,
            registerId: register.id,
            status: "OPEN",
          },
          select: { id: true },
        });
        if (openReg)
          throw errors.BAD_REQUEST({ message: "Este caixa já está aberto." });

        return tx.cashSession.create({
          data: {
            organizationId: orgId,
            memberId: member.id,
            registerId: register.id,
            openedById: context.user.id,
            clientSessionId: input.operationId,
            openingBalance: input.openingBalance,
            openingNotes: input.openingNotes ?? null,
            openedAt,
            movements: {
              create: {
                organizationId: orgId,
                type: "ABERTURA",
                amount: input.openingBalance,
                description: "Abertura de caixa",
                createdById: context.user.id,
              },
            },
          },
          select: { id: true, openedAt: true },
        });
      });
      return {
        sessionId: session.id,
        openedAt: session.openedAt.toISOString(),
        duplicate: false,
      };
    } catch (error) {
      // P2002: corrida. Se foi o `clientSessionId` único, é replay → devolve a
      // existente; senão é o índice parcial "1 OPEN por member/register".
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code?: string }).code === "P2002"
      ) {
        const winner = await prisma.cashSession.findUnique({
          where: { clientSessionId: input.operationId },
          select: { id: true, openedAt: true },
        });
        if (winner)
          return {
            sessionId: winner.id,
            openedAt: winner.openedAt.toISOString(),
            duplicate: true,
          };
        throw errors.BAD_REQUEST({
          message: "Caixa já aberto (por você ou por outro operador).",
        });
      }
      throw error;
    }
  });
