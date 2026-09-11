import "server-only";

import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { dispararCampanha } from "@/features/campanhas/server/disparar";
import { ACOES } from "@/features/stars/lib/acoes-chaves";
import { contaVerificada } from "@/lib/conta-verificada";
import prisma from "@/lib/db";
import { isOrgAdmin } from "@/lib/org-access";
import { executarAcao } from "../acoes/registro";
import type { ContextoToolsApp } from "./_contexto";

/**
 * Campanha de WhatsApp em dois passos, de propósito.
 *
 * `criarCampanhaWhatsapp` monta o rascunho e a audiência — nada sai. Só
 * `enviarCampanhaWhatsapp` dispara, e ele pede a própria aprovação: a
 * diferença entre "montei uma lista" e "mandei mensagem para 800 pessoas" é
 * grande demais para caber num único sim.
 */
export function construirToolsDeAcaoDeCampanha(ctx: ContextoToolsApp): ToolSet {
  const { organizationId, userId } = ctx;

  return {
    criarCampanhaWhatsapp: tool({
      description:
        "Monta uma campanha de WhatsApp como RASCUNHO, com a audiência vinda do funil. Não envia nada. Precisa de aprovação na conversa.",
      inputSchema: z.object({
        nome: z.string().min(1).max(80),
        funil: z
          .string()
          .max(80)
          .optional()
          .describe(
            "Nome do funil; sem isso, usa o único funil da organização.",
          ),
        temperatura: z.enum(["COLD", "WARM", "HOT", "VERY_HOT"]).optional(),
        limite: z.number().int().min(1).max(2000).default(500),
      }),
      execute: async (entrada) =>
        executarAcao(
          ctx,
          "criarCampanhaWhatsapp",
          entrada,
          async () => {
            await exigirAdminEContaDeVerdade(organizationId, userId);

            const funis = await prisma.crmFunnel.findMany({
              where: {
                organizationId,
                isArchived: false,
                ...(entrada.funil
                  ? { name: { contains: entrada.funil, mode: "insensitive" } }
                  : {}),
              },
              select: { id: true, name: true },
              take: 5,
            });
            if (funis.length === 0) {
              throw new Error(
                entrada.funil
                  ? `Nenhum funil chamado "${entrada.funil}".`
                  : "A organização ainda não tem funil de CRM.",
              );
            }
            if (funis.length > 1 && !entrada.funil) {
              throw new Error(
                `Há mais de um funil (${funis.map((f) => f.name).join(", ")}). Diga de qual é a campanha.`,
              );
            }
            const funil = funis[0];
            if (!funil) throw new Error("Funil não encontrado.");

            const campanha = await prisma.broadcast.create({
              data: {
                organizationId,
                funnelId: funil.id,
                createdById: userId,
                name: entrada.nome,
              },
              select: { id: true },
            });

            const candidatos = await prisma.crmLead.findMany({
              where: {
                organizationId,
                funnelId: funil.id,
                isArchived: false,
                phone: { not: null },
                ...(entrada.temperatura
                  ? { temperature: entrada.temperatura }
                  : {}),
              },
              select: { id: true, name: true, phone: true },
              take: entrada.limite,
            });

            // A unique `(broadcastId, phone)` é o que impede o mesmo número
            // duas vezes; `skipDuplicates` só evita o erro.
            const { count } = await prisma.broadcastRecipient.createMany({
              data: candidatos.map((lead) => ({
                broadcastId: campanha.id,
                leadId: lead.id,
                name: lead.name,
                phone: lead.phone as string,
              })),
              skipDuplicates: true,
            });

            await prisma.broadcast.update({
              where: { id: campanha.id },
              data: { totalRecipients: count },
            });

            return {
              campanha: {
                id: campanha.id,
                nome: entrada.nome,
                funil: funil.name,
              },
              destinatarios: count,
              proximoPasso:
                "Escolha um template aprovado da Meta em WhatsApp › Campanhas e depois peça o disparo — nada sai antes disso.",
              link: {
                rotulo: "Abrir a campanha",
                href: "/whatsapp/campanhas",
              },
            };
          },
          {
            actionKey: ACOES.astroCampanha,
            descricao: `Astro — campanha "${entrada.nome}"`,
          },
        ),
    }),

    enviarCampanhaWhatsapp: tool({
      description:
        "DISPARA uma campanha já montada, com o template escolhido. As mensagens saem de verdade. Precisa de aprovação na conversa.",
      inputSchema: z.object({
        campanha: z.string().min(1).max(80).describe("Nome da campanha."),
        template: z.string().min(1).max(80),
        idioma: z.string().min(2).max(10).default("pt_BR"),
        categoria: z
          .enum(["MARKETING", "UTILITY", "AUTHENTICATION"])
          .default("MARKETING"),
      }),
      execute: async (entrada) =>
        executarAcao(ctx, "enviarCampanhaWhatsapp", entrada, async () => {
          await exigirAdminEContaDeVerdade(organizationId, userId);

          const campanha = await prisma.broadcast.findFirst({
            where: {
              organizationId,
              name: { contains: entrada.campanha, mode: "insensitive" },
              status: { in: ["DRAFT", "SCHEDULED"] },
            },
            orderBy: { createdAt: "desc" },
            select: { id: true, name: true },
          });
          if (!campanha) {
            throw new Error(
              `Nenhuma campanha em rascunho chamada "${entrada.campanha}".`,
            );
          }

          await prisma.broadcast.update({
            where: { id: campanha.id },
            data: {
              templateName: entrada.template,
              templateLanguage: entrada.idioma,
              templateCategory: entrada.categoria,
            },
          });

          const resultado = await dispararCampanha({
            broadcastId: campanha.id,
            organizationId,
          });

          return {
            campanha: campanha.name,
            disparando: resultado.disparando,
            destinatarios: resultado.destinatarios,
            aviso:
              "Cada destinatário entregue custa ★, e a Meta cobra a conversa à parte.",
          };
        }),
    }),
  };
}

async function exigirAdminEContaDeVerdade(
  organizationId: string,
  userId: string,
): Promise<void> {
  if (!(await isOrgAdmin(organizationId, userId))) {
    throw new Error("Só administradores mexem em campanhas de WhatsApp.");
  }
  if (!(await contaVerificada(organizationId))) {
    throw new Error(
      "Esta é uma empresa de teste: crie sua conta com o Google para enviar mensagem de verdade.",
    );
  }
}
