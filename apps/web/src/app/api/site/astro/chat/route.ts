import { CABECALHO_DA_VISITA, idDeVisitaValido } from "@nerp/site-content";
import type { UIMessage } from "ai";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  atendimentoConfigurado,
  enviarParaAEquipe,
} from "@/features/astro-consultor/server/atendimento";
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
import { tokenDoSiteConfere } from "@/features/site/server/token-do-site";
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
  /**
   * Quem já se apresentou, nesta visita.
   *
   * Vem do navegador pelo mesmo motivo da trilha: o nome de quem ainda não
   * virou lead não fica no banco. Aqui ele serve a uma coisa só — o Astro não
   * perguntar de novo o que a pessoa já respondeu duas páginas atrás.
   */
  visitante: z
    .object({
      nome: z.string().max(80).optional(),
      empresa: z.string().max(160).optional(),
      cnpj: z.string().max(20).optional(),
    })
    .optional(),
});

/**
 * Uma resposta pronta, no formato de stream que o widget já sabe ler.
 *
 * Serve à sessão que já está com a equipe: nenhum modelo é chamado, mas quem
 * espera do outro lado é o `useChat`, e ele só entende stream de mensagem.
 */
function respostaFixa(texto: string, sessaoId: string): Response {
  const id = "atendimento";
  const partes = [
    { type: "start" },
    { type: "text-start", id },
    { type: "text-delta", id, delta: texto },
    { type: "text-end", id },
    { type: "finish" },
  ];
  const corpo = `${partes.map((p) => `data: ${JSON.stringify(p)}\n\n`).join("")}data: [DONE]\n\n`;

  return new Response(corpo, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      "x-vercel-ai-ui-message-stream": "v1",
      "x-astro-session": sessaoId,
      "x-robots-tag": "noindex",
    },
  });
}

function indisponivel(motivo: string) {
  return NextResponse.json(
    { erro: "astro_indisponivel", motivo },
    { status: 503 },
  );
}

export async function POST(request: NextRequest) {
  if (!tokenDoSiteConfere(request.headers.get("x-site-token"))) {
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

  // A visita medida em que a conversa acontece, quando o site mediu. É dela
  // que o lead herda a campanha: o widget só conhece a página atual.
  const idDaVisita = request.headers.get(CABECALHO_DA_VISITA);
  const visita = idDeVisitaValido(idDaVisita)
    ? await prisma.siteVisit.findUnique({
        where: { id: idDaVisita as string },
        select: {
          id: true,
          utmSource: true,
          utmMedium: true,
          utmCampaign: true,
        },
      })
    : null;

  const agora = new Date();
  const sessao = corpo.data.sessionId
    ? await prisma.siteChatSession.findFirst({
        where: {
          id: corpo.data.sessionId,
          channel: "SITE",
          expiresAt: { gt: agora },
        },
        select: {
          id: true,
          messageCount: true,
          visitId: true,
          handoffAt: true,
        },
      })
    : null;

  /*
    A conversa já é da equipe.

    O widget, quando entra em atendimento, para de postar aqui e passa a falar
    com `/api/site/astro/atendimento`. Esta guarda é para o que escapar disso —
    uma aba antiga, um cliente que não leu a troca de modo. Sem ela, a mensagem
    de quem está esperando uma pessoa seria respondida pelo modelo, e a equipe
    nunca a veria. Aqui ela segue para o Chat de qualquer jeito.
  */
  if (sessao?.handoffAt) {
    const entregue = await enviarParaAEquipe({
      sessaoId: sessao.id,
      texto: textoDaMensagem(ultima),
      ip: ipDaRequisicao(request.headers),
    });
    return respostaFixa(
      entregue.ok
        ? "Recado entregue à equipe. Eles respondem por aqui."
        : "Não consegui entregar sua mensagem à equipe agora. Se puder, chame a gente no WhatsApp.",
      sessao.id,
    );
  }

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
          ...(visita && !sessao.visitId ? { visitId: visita.id } : {}),
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
          visitId: visita?.id ?? null,
          utmSource: corpo.data.utmSource ?? visita?.utmSource ?? null,
          utmMedium: corpo.data.utmMedium ?? visita?.utmMedium ?? null,
          utmCampaign: corpo.data.utmCampaign ?? visita?.utmCampaign ?? null,
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
    visitante: corpo.data.visitante,
    // Sem a chave do Chat no ambiente não há equipe para chamar: a tool e o
    // trecho do prompt ficam de fora, e o Astro segue com formulário e
    // WhatsApp, como era.
    ...(atendimentoConfigurado()
      ? {
          atendimento: {
            pagina: corpo.data.landingPage,
            ip: ipDaRequisicao(request.headers),
          },
        }
      : {}),
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
