import type { UIMessage } from "ai";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  cobrarTokensDoAstro,
  podeConversar,
} from "@/features/astro/server/cobranca";
import {
  LIMITE_TEXTO,
  textoDaMensagem,
} from "@/features/astro-consultor/server/mensagens";
import { streamAstroConsultor } from "@/features/astro-consultor/server/orchestrator";
import {
  ASTRO_PRECOS_KEY,
  lerTabelaDePrecos,
} from "@/features/astro-consultor/server/preco";
import {
  ASTRO_CONFIG_KEY,
  lerConfig,
  resolverModelo,
} from "@/features/astro-consultor/server/provider";
import {
  hashDeIp,
  ipDaRequisicao,
  verificarLimite,
} from "@/features/astro-consultor/server/rate-limit";
import { montarContextoDaLoja } from "@/features/storefront/server/astro/loja";
import { construirToolsDaLoja } from "@/features/storefront/server/astro/tools";
import { emEstrelas } from "@/features/stars/lib/decimal";
import prisma from "@/lib/db";

/**
 * A conversa com o Astro na VITRINE de uma loja.
 *
 * Route handler, e não procedure oRPC, pelo mesmo motivo das outras duas: a
 * resposta é um stream de tokens.
 *
 * O que muda aqui, e é o desenho todo: quem fala é um visitante ANÔNIMO, mas
 * quem paga é a ORGANIZAÇÃO dona do catálogo. Daí as duas guardas empilhadas —
 * as travas por IP e por sessão do consultor (rota pública que chama LLM é
 * conta de API aberta na internet) e, por cima delas, o saldo de ★ da loja:
 * sem saldo para um bloco de tokens, a mensagem nem começa.
 *
 * O `subdomain` vem do CAMINHO e não do corpo: o widget posta um corpo fixo, e
 * um tenant escolhido pelo corpo seria um tenant escolhido pelo cliente.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const SESSAO_HORAS = 24;

const corpoSchema = z.object({
  messages: z.array(z.unknown()).min(1).max(60),
  sessionId: z.string().max(64).optional(),
  landingPage: z.string().max(500).optional(),
  visitante: z
    .object({
      nome: z.string().max(80).optional(),
      empresa: z.string().max(160).optional(),
      cnpj: z.string().max(20).optional(),
    })
    .optional(),
});

function indisponivel(motivo: string) {
  return NextResponse.json(
    { erro: "astro_indisponivel", motivo },
    { status: 503 },
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> },
) {
  const { subdomain } = await params;

  const org = await prisma.organization.findUnique({
    where: { subdomain, verifiedAt: { not: null } },
    select: { id: true, name: true, catalogSettings: true },
  });
  const settings = org?.catalogSettings;
  if (!org || !settings) {
    return NextResponse.json({ erro: "loja_nao_encontrada" }, { status: 404 });
  }
  if (!settings.isActive || !settings.astroEnabled) {
    return indisponivel("desligado_na_loja");
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

  const [configCrua, precosCrus] = await Promise.all([
    prisma.siteSetting.findUnique({ where: { key: ASTRO_CONFIG_KEY } }),
    prisma.siteSetting.findUnique({ where: { key: ASTRO_PRECOS_KEY } }),
  ]);

  const config = lerConfig(configCrua?.value);
  if (!config.ativo) return indisponivel("desligado");

  const modelo = resolverModelo(config.modelo);
  if (!modelo) return indisponivel("sem_chave");

  const ipHash = hashDeIp(ipDaRequisicao(request.headers));

  const agora = new Date();
  const sessao = corpo.data.sessionId
    ? await prisma.siteChatSession.findFirst({
        where: {
          id: corpo.data.sessionId,
          channel: "CATALOGO",
          // A sessão é conferida contra ESTA loja: sem isto, o id de uma
          // conversa de outra vitrine continuaria valendo aqui — e o gasto
          // dela cairia na conta errada.
          organizationId: org.id,
          expiresAt: { gt: agora },
        },
        select: { id: true, messageCount: true },
      })
    : null;

  const veredito = await verificarLimite({ ipHash, sessao });
  if (!veredito.ok) {
    return NextResponse.json(
      { erro: veredito.motivo, mensagem: veredito.mensagem },
      { status: 429 },
    );
  }

  // Sem saldo, a mensagem nem começa: os tokens só são conhecidos no fim do
  // stream, e a essa altura a resposta já foi entregue.
  if (!(await podeConversar(org.id))) {
    const saldo = await prisma.organization.findUnique({
      where: { id: org.id },
      select: { starsBalance: true },
    });
    return NextResponse.json(
      { erro: "sem_estrelas", saldo: emEstrelas(saldo?.starsBalance) },
      { status: 402 },
    );
  }

  // Contar ANTES de abrir o stream: quem desiste e reenvia passaria por baixo
  // da trava se o contador só subisse no fim.
  const sessaoAtual = sessao
    ? await prisma.siteChatSession.update({
        where: { id: sessao.id },
        data: { messageCount: { increment: 1 } },
        select: { id: true },
      })
    : await prisma.siteChatSession.create({
        data: {
          channel: "CATALOGO",
          organizationId: org.id,
          ipHash,
          userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
          landingPage: corpo.data.landingPage ?? null,
          messageCount: 1,
          modelo: config.modelo,
          expiresAt: new Date(agora.getTime() + SESSAO_HORAS * 60 * 60 * 1000),
        },
        select: { id: true },
      });

  const loja = await montarContextoDaLoja({
    organizationId: org.id,
    nome: org.name,
    settings,
  });

  const resultado = await streamAstroConsultor({
    escopo: "catalogo",
    sessaoId: sessaoAtual.id,
    tabelaPrecos: lerTabelaDePrecos(precosCrus?.value),
    modelo,
    mensagens,
    loja,
    visitante: corpo.data.visitante,
    tools: construirToolsDaLoja({
      organizationId: org.id,
      mostraPrecos: settings.showPrices,
      mostraProdutoSemEstoque: settings.showProductWithoutStock,
    }),
    onFinish: async ({ tokensIn, tokensOut }) => {
      // Duas contas, e as duas importam: a sessão guarda o gasto bruto desta
      // vitrine, e o débito em ★ leva o custo para a conta da loja — que é o
      // que faz o atendimento aparecer no extrato dela, e não na fatura de
      // API de ninguém.
      await prisma.siteChatSession.update({
        where: { id: sessaoAtual.id },
        data: {
          tokensIn: { increment: tokensIn },
          tokensOut: { increment: tokensOut },
        },
      });
      await cobrarTokensDoAstro({
        organizationId: org.id,
        tokensIn,
        tokensOut,
        descricao: `Astro — atendimento no catálogo (${(tokensIn + tokensOut).toLocaleString("pt-BR")} tokens)`,
      });
    },
  });

  return resultado.toUIMessageStreamResponse({
    headers: {
      "x-astro-session": sessaoAtual.id,
      "x-robots-tag": "noindex",
    },
  });
}
