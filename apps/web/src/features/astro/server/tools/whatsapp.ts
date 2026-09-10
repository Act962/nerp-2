import "server-only";

import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { contaVerificada } from "@/lib/conta-verificada";
import prisma from "@/lib/db";
import type { ContextoToolsApp } from "./_contexto";

/**
 * WhatsApp: se há número ativo, quais funis existem e o que já foi disparado.
 *
 * Devolve também se a conta é de teste, porque é a diferença entre "dá para
 * disparar" e "não dá" — e o Astro precisa saber explicar o porquê em vez de
 * prometer uma campanha que o servidor vai recusar.
 */
export function construirToolsDeWhatsapp(ctx: ContextoToolsApp): ToolSet {
  const { organizationId } = ctx;

  return {
    estadoDoWhatsapp: tool({
      description:
        "Se a organização tem número de WhatsApp conectado, quais funis existem e as campanhas recentes. Consulte antes de falar em disparo.",
      inputSchema: z.object({}),
      execute: async () => {
        const desde = new Date(Date.now() - 30 * 86_400_000);
        const [conexoes, funis, campanhas, verificada] = await Promise.all([
          prisma.whatsAppConnection.findMany({
            where: { organizationId },
            select: {
              name: true,
              status: true,
              isActive: true,
              phoneNumber: true,
              lastError: true,
              funnel: { select: { name: true } },
            },
          }),
          prisma.crmFunnel.count({
            where: { organizationId, isArchived: false },
          }),
          prisma.broadcast.findMany({
            where: { organizationId, createdAt: { gte: desde } },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
              name: true,
              status: true,
              createdAt: true,
              _count: { select: { recipients: true } },
            },
          }),
          contaVerificada(organizationId),
        ]);

        const ativas = conexoes.filter(
          (conexao) => conexao.status === "CONNECTED" && conexao.isActive,
        );

        return {
          temNumeroAtivo: ativas.length > 0,
          podeDisparar: ativas.length > 0 && verificada,
          motivoSeNaoPode:
            ativas.length === 0
              ? "nenhum número conectado — conecte em WhatsApp › Conexão"
              : !verificada
                ? "a empresa ainda é de teste; crie a conta para enviar mensagem de verdade"
                : null,
          conexoes: conexoes.map((conexao) => ({
            nome: conexao.name,
            funil: conexao.funnel?.name ?? null,
            situacao: conexao.status,
            ativa: conexao.isActive,
            numero: conexao.phoneNumber,
            ultimoErro: conexao.lastError,
          })),
          funis,
          campanhasRecentes: campanhas.map((campanha) => ({
            nome: campanha.name,
            situacao: campanha.status,
            destinatarios: campanha._count.recipients,
            quando: campanha.createdAt.toISOString().slice(0, 10),
          })),
        };
      },
    }),
  };
}
