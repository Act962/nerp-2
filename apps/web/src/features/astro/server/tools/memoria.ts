import "server-only";

import { tool, type ToolSet } from "ai";
import { z } from "zod";
import prisma from "@/lib/db";
import { executarAcao } from "../acoes/registro";
import type { ContextoToolsApp } from "./_contexto";

/**
 * A memória do Astro, por organização.
 *
 * Duas regras a definem. A primeira: ela **nunca** atravessa organização —
 * toda leitura e toda escrita passam por `organizationId` da closure, e o
 * canal do site não tem memória nenhuma. A segunda: lembrar e esquecer pedem
 * o sim da pessoa no cartão, como toda escrita. Guardar em silêncio o que
 * alguém disse de passagem é a diferença entre um assistente e um gravador.
 *
 * A chave é o que faz "lembra que trocamos de fornecedor" atualizar o fato em
 * vez de acumular a décima versão dele.
 */

/** Quantos fatos cabem por organização. Passou disso, o mais velho sai. */
export const MAX_MEMORIAS = 40;

export function construirToolsDeMemoria(ctx: ContextoToolsApp): ToolSet {
  const { organizationId, userId } = ctx;

  return {
    lembrar: tool({
      description:
        "Guarda um fato sobre esta organização para conversas futuras (preferência, combinado, particularidade da operação). Precisa de aprovação na conversa.",
      inputSchema: z.object({
        chave: z
          .string()
          .min(2)
          .max(60)
          .describe(
            "Um rótulo curto e estável do assunto, em minúsculas: 'fornecedor-principal', 'dia-de-reposicao'.",
          ),
        fato: z
          .string()
          .min(3)
          .max(400)
          .describe("O fato em uma frase, do jeito que a pessoa contou."),
      }),
      execute: async (entrada) =>
        executarAcao(ctx, "lembrar", entrada, async () => {
          const chave = entrada.chave.trim().toLowerCase();

          await prisma.astroMemoria.upsert({
            where: { organizationId_chave: { organizationId, chave } },
            create: {
              organizationId,
              chave,
              texto: entrada.fato,
              origem: "pessoa",
              criadoPorId: userId,
            },
            update: { texto: entrada.fato, criadoPorId: userId },
          });

          // Teto por organização: sem ele, a memória cresce para sempre e o
          // prompt engorda junto, mensagem após mensagem.
          const total = await prisma.astroMemoria.count({
            where: { organizationId },
          });
          if (total > MAX_MEMORIAS) {
            const velhas = await prisma.astroMemoria.findMany({
              where: { organizationId },
              orderBy: { updatedAt: "asc" },
              take: total - MAX_MEMORIAS,
              select: { id: true },
            });
            await prisma.astroMemoria.deleteMany({
              where: { id: { in: velhas.map((m) => m.id) } },
            });
          }

          return { chave, guardado: entrada.fato };
        }),
    }),

    esquecer: tool({
      description:
        "Apaga um fato que o Astro guardou, pela chave. Precisa de aprovação na conversa.",
      inputSchema: z.object({ chave: z.string().min(2).max(60) }),
      execute: async (entrada) =>
        executarAcao(ctx, "esquecer", entrada, async () => {
          const chave = entrada.chave.trim().toLowerCase();
          const { count } = await prisma.astroMemoria.deleteMany({
            where: { organizationId, chave },
          });
          if (count === 0) {
            throw new Error(`Eu não guardei nada com a chave "${chave}".`);
          }
          return { chave, esquecido: true };
        }),
    }),

    oQueVoceLembra: tool({
      description: "Lista os fatos que o Astro guardou sobre esta organização.",
      inputSchema: z.object({}),
      execute: async () => {
        const memorias = await prisma.astroMemoria.findMany({
          where: { organizationId },
          orderBy: { updatedAt: "desc" },
          take: MAX_MEMORIAS,
          select: { chave: true, texto: true, origem: true },
        });
        return {
          memorias: memorias.map((memoria) => ({
            chave: memoria.chave,
            fato: memoria.texto,
            origem: memoria.origem,
          })),
        };
      },
    }),
  };
}
