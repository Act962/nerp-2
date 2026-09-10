import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { cobrarValor } from "@/features/stars/server/debitar";
import prisma from "@/lib/db";
import type { ContextoToolsApp } from "../tools/_contexto";

/**
 * O envelope de toda tool que ESCREVE.
 *
 * Faz três coisas que nenhuma delas deve repetir: executa, grava a linha de
 * auditoria (`AstroAcao`) com entrada, saída e erro, e cobra as ★ **depois**
 * do sucesso — cobrar antes deixaria a organização pagando por catálogo que
 * não existe.
 *
 * O erro volta como valor, não como exceção: o modelo precisa ler "não deu, e
 * foi por isso" para explicar à pessoa, em vez de o stream morrer.
 */
export async function executarAcao<T extends Record<string, unknown>>(
  ctx: ContextoToolsApp,
  tool: string,
  entrada: Record<string, unknown>,
  acao: () => Promise<T>,
  cobranca?: { actionKey: string; descricao: string },
): Promise<T | { erro: string }> {
  let resultado: T | null = null;
  let erro: string | null = null;

  try {
    resultado = await acao();
  } catch (excecao) {
    erro =
      excecao instanceof Error
        ? excecao.message
        : "Não foi possível concluir a ação.";
  }

  let starsCobradas = 0;
  if (resultado && cobranca) {
    try {
      const debito = await cobrarValor({
        organizationId: ctx.organizationId,
        actionKey: cobranca.actionKey,
        valor: await precoDaAcao(ctx.organizationId, cobranca.actionKey),
        descricao: cobranca.descricao,
        userId: ctx.userId,
      });
      starsCobradas = debito.valor;
    } catch {
      // Saldo insuficiente não desfaz o que já foi criado: a pessoa aprovou e
      // o catálogo existe. Fica sem cobrança e o pré-check da próxima
      // mensagem segura o resto.
      starsCobradas = 0;
    }
  }

  await prisma.astroAcao
    .create({
      data: {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        sessionId: ctx.sessaoId,
        tool,
        entrada: entrada as Prisma.InputJsonValue,
        resultado: (resultado ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        erro,
        starsCobradas,
      },
    })
    .catch((falha) => {
      // Auditoria que falha não pode derrubar a ação já concluída — mas some
      // do log de ninguém.
      console.error("[astro] falha ao registrar a ação", { tool, falha });
    });

  if (erro) return { erro };
  return resultado as T;
}

async function precoDaAcao(
  organizationId: string,
  actionKey: string,
): Promise<number> {
  const { custoDaAcao } = await import("@/features/stars/server/debitar");
  return custoDaAcao(organizationId, actionKey);
}
