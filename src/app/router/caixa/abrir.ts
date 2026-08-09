import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { memberCan } from "@/lib/permissions";
import { z } from "zod";
import { getCaixaMember } from "./_access";

export const abrirCaixa = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Abrir o caixa", tags: ["caixa"] })
  .input(
    z.object({
      registerId: z.string().min(1, "Escolha o caixa"),
      openingBalance: z.number().min(0),
      accountId: z.string().optional(),
      openingNotes: z.string().optional(),
    }),
  )
  .output(z.object({ id: z.string(), openedAt: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const member = await getCaixaMember(context.org.id, context.user.id);
    if (!member)
      throw errors.FORBIDDEN({
        message: "Você não é membro desta organização",
      });
    if (!memberCan(member, "caixa-abrir"))
      throw errors.FORBIDDEN({
        message: "Você não tem permissão para abrir o caixa",
      });

    if (input.accountId) {
      const account = await prisma.financialAccount.findFirst({
        where: { id: input.accountId, organizationId: context.org.id },
        select: { id: true },
      });
      if (!account)
        throw errors.NOT_FOUND({ message: "Conta financeira não encontrada" });
    }

    const register = await prisma.cashRegister.findFirst({
      where: {
        id: input.registerId,
        organizationId: context.org.id,
        isActive: true,
      },
      select: { id: true },
    });
    if (!register)
      throw errors.NOT_FOUND({ message: "Caixa não encontrado ou inativo" });

    try {
      const session = await prisma.$transaction(async (tx) => {
        const open = await tx.cashSession.findFirst({
          where: {
            organizationId: context.org.id,
            memberId: member.id,
            status: "OPEN",
          },
          select: { id: true },
        });
        if (open)
          throw errors.BAD_REQUEST({
            message:
              "Você já tem um caixa aberto. Feche-o antes de abrir outro.",
          });

        const openRegister = await tx.cashSession.findFirst({
          where: {
            organizationId: context.org.id,
            registerId: input.registerId,
            status: "OPEN",
          },
          select: { id: true },
        });
        if (openRegister)
          throw errors.BAD_REQUEST({
            message: "Este caixa já está aberto por outro operador.",
          });

        return tx.cashSession.create({
          data: {
            organizationId: context.org.id,
            memberId: member.id,
            registerId: input.registerId,
            openedById: context.user.id,
            accountId: input.accountId ?? null,
            openingBalance: input.openingBalance,
            openingNotes: input.openingNotes ?? null,
            movements: {
              create: {
                organizationId: context.org.id,
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
      return { id: session.id, openedAt: session.openedAt.toISOString() };
    } catch (error) {
      // Índice parcial `cash_sessions_open_per_member` fecha a corrida entre a
      // checagem e o create; reapresenta como erro amigável.
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code?: string }).code === "P2002"
      ) {
        throw errors.BAD_REQUEST({
          message: "Caixa já aberto (por você ou por outro operador).",
        });
      }
      throw error;
    }
  });
