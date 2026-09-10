import "server-only";

import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { limiteDeStars } from "@/features/billing/lib/planos";
import { planoDaOrganizacao } from "@/features/billing/server/plano-da-organizacao";
import { getPublicSiteContent } from "@/features/site/server/public-content";
import prisma from "@/lib/db";
import { executarAcao } from "../acoes/registro";
import type { ContextoToolsApp } from "./_contexto";

/**
 * A saída para gente.
 *
 * `contatoDoSuporte` só informa. `contatarSuporte` ABRE o chamado: grava um
 * `SiteLead` com quem pediu, de que empresa e em que plano, e devolve o link
 * do WhatsApp já com a mensagem escrita. É o que transforma "fala com o
 * suporte" numa conversa que o time encontra, em vez de um número que a pessoa
 * copia e nunca usa.
 *
 * O lead é GLOBAL, como o do site: as tabelas `site_*` não têm
 * `organizationId` porque o site é um só. Quem é a empresa entra no briefing,
 * que é onde o time comercial procura contexto antes de ligar.
 */

/** O mesmo número do site institucional, para o suporte nunca ficar sem canal. */
const WHATSAPP_PADRAO = "558698221810";

export function construirToolsDeSuporte(ctx: ContextoToolsApp): ToolSet {
  const { organizationId, userId } = ctx;

  return {
    contatoDoSuporte: tool({
      description:
        "O contato do suporte da ÓRBITA (WhatsApp e e-mail), para quando a pessoa precisa falar com gente.",
      inputSchema: z.object({}),
      execute: async () => {
        const conteudo = await getPublicSiteContent();
        const numero = conteudo.whatsapp?.number ?? WHATSAPP_PADRAO;
        return {
          whatsapp: numero,
          whatsappHref: `https://wa.me/${numero}`,
          email: conteudo.contact?.email ?? null,
        };
      },
    }),

    contatarSuporte: tool({
      description:
        "Abre um chamado com o suporte da ÓRBITA: registra o assunto e o contexto para o time e devolve o link do WhatsApp já com a mensagem pronta. Use quando o problema não se resolve na conversa. Precisa de aprovação.",
      inputSchema: z.object({
        assunto: z
          .string()
          .min(4)
          .max(120)
          .describe("Uma linha: do que se trata."),
        resumo: z
          .string()
          .min(10)
          .max(1200)
          .describe(
            "O que o time precisa saber para já chegar sabendo: o que a pessoa tentou, o que aconteceu e o que ela espera.",
          ),
      }),
      execute: async (entrada) =>
        executarAcao(ctx, "contatarSuporte", entrada, async () => {
          const [org, usuario, conteudo, { plano, origem }] = await Promise.all(
            [
              prisma.organization.findUniqueOrThrow({
                where: { id: organizationId },
                select: {
                  name: true,
                  verifiedAt: true,
                  starsBalance: true,
                  starsUsedInCycle: true,
                },
              }),
              prisma.user.findUniqueOrThrow({
                where: { id: userId },
                select: { name: true, email: true, whatsapp: true },
              }),
              getPublicSiteContent(),
              planoDaOrganizacao(organizationId),
            ],
          );

          const briefing = {
            origem: "astro-app",
            organizationId,
            organizacao: org.name,
            plano: plano.id,
            origemDoPlano: origem,
            contaDeTeste: org.verifiedAt === null,
            stars: {
              saldo: org.starsBalance,
              consumidoNoCiclo: org.starsUsedInCycle,
              limite: limiteDeStars(plano),
            },
            assunto: entrada.assunto,
            resumo: entrada.resumo,
            sessaoId: ctx.sessaoId,
          };

          // Um chamado por assunto por organização: reabrir o mesmo assunto
          // atualiza o lead em vez de encher a caixa do time com cópias.
          const existente = await prisma.siteLead.findFirst({
            where: {
              email: usuario.email,
              briefing: {
                path: ["assunto"],
                equals: entrada.assunto,
              },
            },
            select: { id: true },
          });

          const dados = {
            name: usuario.name,
            company: org.name,
            email: usuario.email,
            phone: usuario.whatsapp,
            briefing,
          };

          const lead = existente
            ? await prisma.siteLead.update({
                where: { id: existente.id },
                data: dados,
                select: { id: true },
              })
            : await prisma.siteLead.create({
                data: dados,
                select: { id: true },
              });

          const numero = conteudo.whatsapp?.number ?? WHATSAPP_PADRAO;
          const mensagem = `Olá! Sou ${usuario.name}, da ${org.name}. Assunto: ${entrada.assunto}.`;

          return {
            chamado: { id: lead.id, assunto: entrada.assunto },
            email: conteudo.contact?.email ?? null,
            // Sai como `formulario` porque é a forma que o widget já desenha
            // para endereço externo — o botão abre em aba nova e a conversa
            // fica aberta atrás dele.
            formulario: {
              url: `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`,
              rotulo: "Falar no WhatsApp",
              motivo: "O time já recebeu o assunto e o resumo.",
            },
            instrucao:
              "Diga em uma frase que o chamado foi aberto e que o time já recebe o contexto. O botão do WhatsApp aparece sozinho — não escreva o endereço.",
          };
        }),
    }),
  };
}
