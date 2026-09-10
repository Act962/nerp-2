import type { UIMessage } from "ai";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  cobrarTokensDoAstro,
  podeConversar,
} from "@/features/astro/server/cobranca";
import {
  CONFIGURACAO_DE_APROVACAO,
  segredoDeAprovacao,
} from "@/features/astro/server/acoes/aprovacao";
import { construirToolsDoApp } from "@/features/astro/server/tools-app";
import {
  LIMITE_TEXTO,
  textoDaMensagem,
} from "@/features/astro-consultor/server/mensagens";
import {
  falaDoVisitante,
  streamAstroConsultor,
} from "@/features/astro-consultor/server/orchestrator";
import {
  ASTRO_PRECOS_KEY,
  lerTabelaDePrecos,
} from "@/features/astro-consultor/server/preco";
import {
  ASTRO_CONFIG_KEY,
  lerConfig,
  resolverModelo,
} from "@/features/astro-consultor/server/provider";
import { LIMITES } from "@/features/astro-consultor/server/rate-limit";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";

/**
 * A conversa com o Astro, de dentro do nerp.
 *
 * Route handler, e não procedure oRPC, pelo mesmo motivo da rota do site: a
 * resposta é um stream. A guarda é outra — sessão do Better Auth e
 * organização ativa, como qualquer página logada — e as tools são as do
 * app, com `organizationId` em closure.
 *
 * A cobrança é em ★ da organização: sem saldo para um bloco de tokens, a
 * mensagem nem começa (402). O débito de verdade acontece no fim do stream,
 * quando os tokens são conhecidos.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const SESSAO_HORAS = 24;

const corpoSchema = z.object({
  messages: z.array(z.unknown()).min(1).max(60),
  sessionId: z.string().max(64).optional(),
});

function indisponivel(motivo: string) {
  return NextResponse.json(
    { erro: "astro_indisponivel", motivo },
    { status: 503 },
  );
}

export async function POST(request: NextRequest) {
  const sessaoAuth = await auth.api.getSession({ headers: request.headers });
  if (!sessaoAuth) {
    return NextResponse.json({ erro: "nao_autorizado" }, { status: 401 });
  }

  const org = await auth.api
    .getFullOrganization({ headers: request.headers })
    .catch(() => null);
  if (!org) {
    return NextResponse.json({ erro: "sem_organizacao" }, { status: 403 });
  }

  const membro = await prisma.member.findFirst({
    where: { organizationId: org.id, userId: sessaoAuth.user.id },
    select: { id: true },
  });
  if (!membro) {
    return NextResponse.json({ erro: "sem_organizacao" }, { status: 403 });
  }

  const corpoCru = await request.json().catch(() => null);
  const corpo = corpoSchema.safeParse(corpoCru);
  if (!corpo.success) {
    return NextResponse.json({ erro: "corpo_invalido" }, { status: 400 });
  }

  const mensagens = corpo.data.messages as UIMessage[];
  if (textoDaMensagem(mensagens.at(-1)).length > LIMITE_TEXTO) {
    return NextResponse.json({ erro: "mensagem_longa" }, { status: 413 });
  }

  // A mesma chave de configuração do site: ligar/desligar e o modelo valem
  // para os dois canais.
  const [configCrua, precosCrus] = await Promise.all([
    prisma.siteSetting.findUnique({ where: { key: ASTRO_CONFIG_KEY } }),
    prisma.siteSetting.findUnique({ where: { key: ASTRO_PRECOS_KEY } }),
  ]);
  const tabelaPrecos = lerTabelaDePrecos(precosCrus?.value);
  const config = lerConfig(configCrua?.value);
  if (!config.ativo) return indisponivel("desligado");

  const modelo = resolverModelo(config.modelo);
  if (!modelo) return indisponivel("sem_chave");

  if (!(await podeConversar(org.id))) {
    const saldo = await prisma.organization.findUnique({
      where: { id: org.id },
      select: { starsBalance: true },
    });
    return NextResponse.json(
      {
        erro: "sem_saldo",
        saldo: saldo?.starsBalance ?? 0,
        mensagem: "Suas Stars acabaram. Compre mais para continuar a conversa.",
      },
      { status: 402 },
    );
  }

  const agora = new Date();
  // Escopada por organização E usuário: o id da sessão vem do navegador, e
  // sem isto um id adivinhado continuaria a conversa de outra pessoa.
  const sessao = corpo.data.sessionId
    ? await prisma.siteChatSession.findFirst({
        where: {
          id: corpo.data.sessionId,
          channel: "APP",
          organizationId: org.id,
          userId: sessaoAuth.user.id,
          expiresAt: { gt: agora },
        },
        select: { id: true, messageCount: true },
      })
    : null;

  if (sessao && sessao.messageCount >= LIMITES.mensagensPorSessao) {
    return NextResponse.json(
      {
        erro: "sessao_cheia",
        mensagem: "Esta conversa ficou longa. Comece uma nova.",
      },
      { status: 429 },
    );
  }

  const sessaoAtual = sessao
    ? await prisma.siteChatSession.update({
        where: { id: sessao.id },
        data: { messageCount: { increment: 1 } },
        select: { id: true },
      })
    : await prisma.siteChatSession.create({
        data: {
          channel: "APP",
          organizationId: org.id,
          userId: sessaoAuth.user.id,
          userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
          messageCount: 1,
          expiresAt: new Date(agora.getTime() + SESSAO_HORAS * 60 * 60 * 1000),
        },
        select: { id: true },
      });

  const resultado = await streamAstroConsultor({
    escopo: "app",
    sessaoId: sessaoAtual.id,
    tabelaPrecos,
    modelo,
    mensagens,
    organizacao: org.name,
    usuario: `${sessaoAuth.user.name} (${sessaoAuth.user.email})`,
    // Quem fala já é conhecido: vai como "visitante" para ele não perguntar.
    visitante: { nome: sessaoAuth.user.name, empresa: org.name },
    toolApproval: CONFIGURACAO_DE_APROVACAO,
    approvalSecret: segredoDeAprovacao(),
    tools: construirToolsDoApp({
      organizationId: org.id,
      userId: sessaoAuth.user.id,
      sessaoId: sessaoAtual.id,
      tabelaPrecos,
      falaDoVisitante: falaDoVisitante(mensagens),
    }),
    onFinish: async ({ tokensIn, tokensOut }) => {
      await prisma.siteChatSession.update({
        where: { id: sessaoAtual.id },
        data: {
          tokensIn: { increment: tokensIn },
          tokensOut: { increment: tokensOut },
        },
      });
      // Falha na cobrança não pode derrubar o stream que já foi entregue;
      // fica no log, e o pré-check da próxima mensagem segura o resto.
      try {
        await cobrarTokensDoAstro({
          organizationId: org.id,
          userId: sessaoAuth.user.id,
          tokensIn,
          tokensOut,
        });
      } catch (erro) {
        console.error("[astro] falha ao cobrar tokens", erro);
      }
    },
  });

  return resultado.toUIMessageStreamResponse({
    headers: { "x-astro-session": sessaoAtual.id },
  });
}
