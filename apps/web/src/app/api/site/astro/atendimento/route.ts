import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  abrirAtendimento,
  enviarParaAEquipe,
  type Falha,
  lerRespostasDaEquipe,
} from "@/features/astro-consultor/server/atendimento";
import {
  LIMITE_DO_CHAT,
  montarPedido,
} from "@/features/astro-consultor/server/atendimento-texto";
import {
  ASTRO_CONFIG_KEY,
  lerConfig,
} from "@/features/astro-consultor/server/provider";
import {
  hashDeIp,
  ipDaRequisicao,
  verificarLimite,
} from "@/features/astro-consultor/server/rate-limit";
import { tokenDoSiteConfere } from "@/features/site/server/token-do-site";
import prisma from "@/lib/db";

/**
 * O atendimento humano do Astro do site.
 *
 * Depois que o visitante pede uma pessoa, a conversa sai do modelo e passa a
 * correr no Chat do Órbita. Esta rota é o caminho de ida e de volta:
 *
 * - `POST { iniciar }` — o botão "Falar com uma pessoa". Abre o atendimento
 *   sem passar pelo modelo: quem clicou num botão não pode depender de uma IA
 *   decidir chamar a tool certa.
 * - `POST { texto }` — uma mensagem do visitante para a equipe.
 * - `GET  ?sessionId&after` — o que a equipe respondeu desde o cursor.
 *
 * Como a rota do chat, não tem CORS: quem chama é o servidor do `apps/site`,
 * com o `SITE_ASTRO_TOKEN`. O que identifica a conversa é o id da sessão, que
 * só o navegador daquele visitante conhece — o token do Chat nunca sai daqui.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSAO_HORAS = 24;

const STATUS: Record<Falha["motivo"], number> = {
  nao_configurado: 503,
  indisponivel: 503,
  sem_atendimento: 409,
  limite: 429,
};

function falhou(falha: Falha) {
  return NextResponse.json(
    { erro: falha.motivo },
    { status: STATUS[falha.motivo] },
  );
}

const envioSchema = z.object({
  sessionId: z.string().max(64).optional(),
  iniciar: z.boolean().optional(),
  texto: z.string().trim().min(1).max(LIMITE_DO_CHAT).optional(),
  landingPage: z.string().max(500).optional(),
  /**
   * O que o navegador sabe de quem está falando, para a equipe não começar do
   * zero. Vem de lá pelo mesmo motivo da trilha: a transcrição não é guardada
   * no servidor, então só o navegador tem as últimas falas.
   */
  contexto: z
    .object({
      nome: z.string().max(80).optional(),
      empresa: z.string().max(160).optional(),
      falas: z.array(z.string().max(600)).max(4).optional(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  if (!tokenDoSiteConfere(request.headers.get("x-site-token"))) {
    return NextResponse.json({ erro: "nao_autorizado" }, { status: 401 });
  }

  const corpo = envioSchema.safeParse(await request.json().catch(() => null));
  if (!corpo.success || (!corpo.data.iniciar && !corpo.data.texto)) {
    return NextResponse.json({ erro: "corpo_invalido" }, { status: 400 });
  }

  const ip = ipDaRequisicao(request.headers);

  if (!corpo.data.iniciar) {
    if (!corpo.data.sessionId) {
      return falhou({ ok: false, motivo: "sem_atendimento" });
    }
    const envio = await enviarParaAEquipe({
      sessaoId: corpo.data.sessionId,
      texto: corpo.data.texto as string,
      ip,
    });
    return envio.ok ? NextResponse.json({ id: envio.id }) : falhou(envio);
  }

  // Daqui para baixo: o botão. Pode ser a PRIMEIRA coisa que o visitante faz
  // no widget, então a sessão talvez ainda não exista.
  const agora = new Date();
  const existente = corpo.data.sessionId
    ? await prisma.siteChatSession.findFirst({
        where: {
          id: corpo.data.sessionId,
          channel: "SITE",
          expiresAt: { gt: agora },
        },
        select: { id: true, messageCount: true },
      })
    : null;

  let sessaoId = existente?.id ?? null;
  if (!sessaoId) {
    // Sessão nova custa uma linha no banco e um lead no Chat: passa pelas
    // mesmas travas por visitante que a conversa com o modelo.
    const configCrua = await prisma.siteSetting.findUnique({
      where: { key: ASTRO_CONFIG_KEY },
    });
    const ipHash = hashDeIp(ip);
    const veredito = await verificarLimite({
      ipHash,
      sessao: null,
      tetoMensagensDia: lerConfig(configCrua?.value).tetoMensagensDia,
    });
    if (!veredito.ok) {
      return NextResponse.json(
        { erro: veredito.motivo, mensagem: veredito.mensagem },
        { status: 429 },
      );
    }

    const nova = await prisma.siteChatSession.create({
      data: {
        channel: "SITE",
        ipHash,
        userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
        landingPage: corpo.data.landingPage ?? null,
        messageCount: 0,
        expiresAt: new Date(agora.getTime() + SESSAO_HORAS * 60 * 60 * 1000),
      },
      select: { id: true },
    });
    sessaoId = nova.id;
  }

  const falas = (corpo.data.contexto?.falas ?? [])
    .map((fala) => fala.trim())
    .filter(Boolean);

  const aberto = await abrirAtendimento({
    sessaoId,
    pagina: corpo.data.landingPage,
    ip,
    pedido: montarPedido({
      nome: corpo.data.contexto?.nome,
      empresa: corpo.data.contexto?.empresa,
      pagina: corpo.data.landingPage,
      motivo: 'Clicou em "Falar com uma pessoa".',
      resumo:
        falas.length > 0
          ? `Últimas mensagens do visitante: ${falas.map((fala) => `"${fala}"`).join(" · ")}`
          : undefined,
    }),
  });
  if (!aberto.ok) return falhou(aberto);

  return NextResponse.json({ sessionId: sessaoId, cursor: aberto.cursor });
}

const consultaSchema = z.object({
  sessionId: z.string().min(1).max(64),
  after: z.string().max(64).optional(),
});

export async function GET(request: NextRequest) {
  if (!tokenDoSiteConfere(request.headers.get("x-site-token"))) {
    return NextResponse.json({ erro: "nao_autorizado" }, { status: 401 });
  }

  const consulta = consultaSchema.safeParse({
    sessionId: request.nextUrl.searchParams.get("sessionId") ?? "",
    after: request.nextUrl.searchParams.get("after") ?? undefined,
  });
  if (!consulta.success) {
    return NextResponse.json({ erro: "consulta_invalida" }, { status: 400 });
  }

  const lido = await lerRespostasDaEquipe({
    sessaoId: consulta.data.sessionId,
    depois: consulta.data.after ?? null,
  });
  if (!lido.ok) return falhou(lido);

  return NextResponse.json(
    { respostas: lido.respostas, cursor: lido.cursor },
    { headers: { "cache-control": "no-store", "x-robots-tag": "noindex" } },
  );
}
