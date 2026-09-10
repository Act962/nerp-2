import "server-only";

import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { ACOES } from "@/features/stars/lib/acoes-chaves";
import prisma from "@/lib/db";
import type { ContextoToolsApp } from "./_contexto";
import { intervaloDoPeriodo, PERIODOS, ROTULO_DO_PERIODO } from "../periodo";

/** O saldo de ★ por dentro: o extrato e quanto o próprio Astro consumiu. */
export function construirToolsDeStars(ctx: ContextoToolsApp): ToolSet {
  const { organizationId } = ctx;

  return {
    extratoDeStars: tool({
      description:
        "O extrato de Stars (★) da organização: cada crédito e cada débito, do mais recente para o mais antigo.",
      inputSchema: z.object({
        limite: z.number().int().min(1).max(30).default(15),
      }),
      execute: async ({ limite }) => {
        const lancamentos = await prisma.starTransaction.findMany({
          where: { organizationId },
          orderBy: { createdAt: "desc" },
          take: limite,
          select: {
            type: true,
            amount: true,
            balanceAfter: true,
            description: true,
            createdAt: true,
          },
        });
        return {
          lancamentos: lancamentos.map((linha) => ({
            tipo: linha.type,
            valor: linha.amount,
            saldoDepois: linha.balanceAfter,
            descricao: linha.description,
            quando: linha.createdAt.toISOString(),
          })),
        };
      },
    }),

    consumoDoAstro: tool({
      description:
        "Quantas Stars as conversas com o Astro consumiram num período, e em quantas respostas.",
      inputSchema: z.object({ periodo: z.enum(PERIODOS).default("30d") }),
      execute: async ({ periodo }) => {
        const intervalo = intervaloDoPeriodo(periodo);
        const resumo = await prisma.starTransaction.aggregate({
          where: {
            organizationId,
            actionKey: ACOES.astroTokens,
            createdAt: { gte: intervalo.from, lt: intervalo.to },
          },
          _sum: { amount: true },
          _count: { _all: true },
        });
        return {
          periodo: ROTULO_DO_PERIODO[periodo],
          starsConsumidas: Math.abs(resumo._sum.amount ?? 0),
          respostasCobradas: resumo._count._all,
        };
      },
    }),
  };
}
