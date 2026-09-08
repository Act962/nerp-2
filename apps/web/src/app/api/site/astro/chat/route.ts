import { timingSafeEqual } from "node:crypto";
import type { UIMessage } from "ai";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
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
import prisma from "@/lib/db";

/**
 * A conversa com o Astro, vinda do site institucional.
 *
 * É route handler e não procedure oRPC porque a resposta é um stream de
 * tokens: o `RPCHandler` serializa o retorno, e streaming precisa de um
 * `Response` com corpo de stream.
 *
 * NÃO TEM CORS, e isso é a escolha central do desenho. As `/api/site/*` de
 * conteúdo podem ser `Access-Control-Allow-Origin: *` porque são GET
 * idempotentes; esta grava lead e gasta token de LLM. Quem chama é o servidor
 * do `apps/site`, por um proxy same-origin, com o segredo `SITE_ASTRO_TOKEN`
 * no cabeçalho — o browser do visitante nunca fala com esta rota.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const SESSAO_HORAS = 24;

const corpoSchema = z.object({
  // `UIMessage` do AI SDK: a forma é do SDK, e revalidá-la campo a campo aqui
  // só criaria uma segunda definição para divergir da primeira. O que importa
  // travar é o tamanho — e isso está logo abaixo.
  messages: z.array(z.unknown()).min(1).max(60),
  sessionId: z.string().max(64).optional(),
  consent: z.boolean().optional(),
  landingPage: z.string().max(500).optional(),
  utmSource: z.string().max(120).optional(),
  utmMedium: z.string().max(120).optional(),
  utmCampaign: z.string().max(120).optional(),
  /** Onde a pessoa está agora, com o que o admin cadastrou daquela página. */
  pagina: z
    .object({
      slug: z.string().max(120),
      titulo: z.string().max(200),
      palavrasChave: z.array(z.string().max(40)).max(12).default([]),
      resumo: z.string().max(600).default(""),
    })
    .optional(),
  /** Por onde ela passou nesta visita. Vem do navegador, não do banco. */
  trilha: z
    .array(z.object({ slug: z.string().max(120), titulo: z.string().max(200) }))
    .max(12)
    .optional(),
});

/** Tamanho máximo de uma mensagem do visitante. */
const LIMITE_TEXTO = 2000;

function tokenConfere(recebido: string | null): boolean {
  const esperado = process.env.SITE_ASTRO_TOKEN;
  // Sem segredo configurado a rota fica aberta em dev — em produção, defina.
  if (!esperado) return true;
  if (!recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

function indisponivel(motivo: string) {
  return NextResponse.json(
    { erro: "astro_indisponivel", motivo },
    { status: 503 },
  );
}

/** O texto de uma `UIMessage`, para medir o que o visitante mandou. */
function textoDaMensagem(mensagem: unknown): string {
  if (typeof mensagem !== "object" || mensagem === null) return "";
  const partes = (mensagem as { parts?: unknown }).parts;
  if (!Array.isArray(partes)) return "";
  return partes
    .map((parte) =>
      typeof parte === "object" &&
      parte !== null &&
      (parte as { type?: unknown }).type === "text"
        ? String((parte as { text?: unknown }).text ?? "")
        : "",
    )
    .join(" ");
}

export async function POST(request: NextRequest) {
  if (!tokenConfere(request.headers.get("x-site-token"))) {
    return NextResponse.json({ erro: "nao_autorizado" }, { status: 401 });
  }

  const corpoCru = await request.json().catch(() => null);
  const corpo = corpoSchema.safeParse(corpoCru);
  if (!corpo.success) {
    return NextResponse.json({ erro: "corpo_invalido" }, { status: 400 });
  }

  const mensagens = corpo.data.messages as UIMessage[];
  const ultima = mensagens.at(-1);
  if (textoDaMensagem(ultima).length > LIMITE_TEXTO) {
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
          channel: "SITE",
          expiresAt: { gt: agora },
        },
        select: { id: true, messageCount: true },
      })
    : null;

  const veredito = await verificarLimite({
    ipHash,
    sessao,
    tetoMensagensDia: config.tetoMensagensDia,
  });
  if (!veredito.ok) {
    return NextResponse.json(
      { erro: veredito.motivo, mensagem: veredito.mensagem },
      { status: 429 },
    );
  }

  // Contar ANTES de abrir o stream: uma requisição que trave no modelo já
  // consumiu cota, senão quem desiste e reenvia passa por baixo da trava.
  const sessaoAtual = sessao
    ? await prisma.siteChatSession.update({
        where: { id: sessao.id },
        data: {
          messageCount: { increment: 1 },
          // A trilha cresce com a visita: guardar a mais recente é o que
          // permite ler depois por onde a pessoa andou antes de virar lead.
          ...(corpo.data.trilha ? { trilha: corpo.data.trilha } : {}),
        },
        select: { id: true },
      })
    : await prisma.siteChatSession.create({
        data: {
          channel: "SITE",
          ipHash,
          userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
          landingPage: corpo.data.landingPage ?? null,
          trilha: corpo.data.trilha ?? undefined,
          utmSource: corpo.data.utmSource ?? null,
          utmMedium: corpo.data.utmMedium ?? null,
          utmCampaign: corpo.data.utmCampaign ?? null,
          messageCount: 1,
          consentAt: corpo.data.consent ? agora : null,
          expiresAt: new Date(agora.getTime() + SESSAO_HORAS * 60 * 60 * 1000),
        },
        select: { id: true },
      });

  const resultado = await streamAstroConsultor({
    escopo: "site",
    sessaoId: sessaoAtual.id,
    tabelaPrecos: lerTabelaDePrecos(precosCrus?.value),
    modelo,
    mensagens,
    navegacao: { pagina: corpo.data.pagina, trilha: corpo.data.trilha },
    onFinish: async ({ tokensIn, tokensOut }) => {
      // O gasto é medido desde o primeiro dia: sem isto, o custo do consultor
      // só aparece na fatura.
      await prisma.siteChatSession.update({
        where: { id: sessaoAtual.id },
        data: {
          tokensIn: { increment: tokensIn },
          tokensOut: { increment: tokensOut },
        },
      });
    },
  });

  return resultado.toUIMessageStreamResponse({
    headers: {
      // A sessão volta no cabeçalho: o corpo é stream, e o cliente precisa
      // dela já na primeira resposta para continuar a conversa.
      "x-astro-session": sessaoAtual.id,
      "x-robots-tag": "noindex",
    },
  });
}
