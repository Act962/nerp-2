import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";

/**
 * Estágios que todo funil novo já nasce tendo.
 *
 * Um funil sem estágio não consegue receber lead — o card não teria coluna
 * onde pousar, e a mensagem que chega de um número desconhecido seria
 * descartada. Por isso a criação é uma transação: funil e estágios entram
 * juntos ou nenhum entra.
 *
 * A ordem é fracionária porque o board move card pelo ponto médio entre os
 * vizinhos; começar de 1000 em 1000 deixa espaço para inserir no meio muitas
 * vezes antes de precisar renumerar.
 */
const ESTAGIOS_PADRAO = [
  { name: "Novo", color: "#3b82f6", order: 1000 },
  { name: "Em atendimento", color: "#f59e0b", order: 2000 },
  { name: "Proposta", color: "#8b5cf6", order: 3000 },
  { name: "Ganho", color: "#22c55e", order: 4000 },
  { name: "Perdido", color: "#ef4444", order: 5000 },
] as const;

export const createFunnel = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Cria um funil de atendimento",
    tags: ["CRM"],
  })
  .input(
    z.object({
      name: z.string().trim().min(1, "Informe o nome do funil"),
      description: z.string().trim().optional(),
    }),
  )
  .output(z.object({ id: z.string(), name: z.string() }))
  .handler(async ({ input, context }) => {
    const organizationId = context.org.id;

    const funil = await prisma.$transaction(async (tx) => {
      const criado = await tx.crmFunnel.create({
        data: {
          organizationId,
          name: input.name,
          description: input.description || null,
        },
        select: { id: true, name: true },
      });

      await tx.crmStage.createMany({
        data: ESTAGIOS_PADRAO.map((estagio) => ({
          organizationId,
          funnelId: criado.id,
          name: estagio.name,
          color: estagio.color,
          order: estagio.order,
        })),
      });

      // Quem cria é dono: sem isso o próprio criador não apareceria na lista
      // de participantes e o funil ficaria sem responsável.
      await tx.crmFunnelParticipant.create({
        data: {
          organizationId,
          funnelId: criado.id,
          userId: context.user.id,
          role: "OWNER",
        },
      });

      return criado;
    });

    return funil;
  });
