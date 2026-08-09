import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";
import { getCaixaMember } from "./_access";

// Histórico de sessões de caixa da org (visão de gestão). Paginação por cursor.
export const listCaixaSessions = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(50).optional(),
    }),
  )
  .output(
    z.object({
      sessions: z.array(
        z.object({
          id: z.string(),
          status: z.enum(["OPEN", "CLOSED"]),
          registerName: z.string(),
          operatorName: z.string(),
          openingBalance: z.number(),
          expectedBalance: z.number().nullable(),
          countedBalance: z.number().nullable(),
          difference: z.number().nullable(),
          openedAt: z.string(),
          closedAt: z.string().nullable(),
        }),
      ),
      nextCursor: z.string().nullable(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const member = await getCaixaMember(context.org.id, context.user.id);
    if (!member)
      throw errors.FORBIDDEN({
        message: "Você não é membro desta organização",
      });

    const take = input.limit ?? 20;
    const rows = await prisma.cashSession.findMany({
      where: { organizationId: context.org.id },
      orderBy: { openedAt: "desc" },
      take: take + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        status: true,
        openingBalance: true,
        expectedBalance: true,
        countedBalance: true,
        difference: true,
        openedAt: true,
        closedAt: true,
        register: { select: { name: true } },
        member: { select: { user: { select: { name: true } } } },
      },
    });

    const nextCursor = rows.length > take ? rows[take].id : null;
    const sessions = rows.slice(0, take).map((row) => ({
      id: row.id,
      status: row.status,
      registerName: row.register.name,
      operatorName: row.member.user.name,
      openingBalance: Number(row.openingBalance),
      expectedBalance:
        row.expectedBalance === null ? null : Number(row.expectedBalance),
      countedBalance:
        row.countedBalance === null ? null : Number(row.countedBalance),
      difference: row.difference === null ? null : Number(row.difference),
      openedAt: row.openedAt.toISOString(),
      closedAt: row.closedAt?.toISOString() ?? null,
    }));

    return { sessions, nextCursor };
  });
