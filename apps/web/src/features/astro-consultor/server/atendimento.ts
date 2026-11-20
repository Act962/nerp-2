import "server-only";

import prisma from "@/lib/db";
import {
  cortar,
  lerMensagens,
  type RespostaDaEquipe,
} from "./atendimento-texto";

/**
 * A ponte para o atendimento humano.
 *
 * Quando o visitante do site pede uma pessoa, a conversa passa a correr no
 * Chat do Órbita, pelo canal ASTRO CHAT — o mesmo que qualquer cliente do
 * Órbita usa para pôr um chat no próprio site. Não há rota nova do outro lado:
 * a ponte fala com a API pública que já existe (`/api/astro-chat/<chave>/…`),
 * e por isso a conversa aparece no filtro do ASTRO sem ninguém mexer lá.
 *
 * Quem chama é o SERVIDOR, não o navegador, e isso muda duas coisas:
 *
 * - a rota confere o cabeçalho `Origin` contra os domínios cadastrados. No
 *   navegador ele vem sozinho; aqui é mandado à mão, com o domínio do site.
 * - o token do visitante de lá fica no banco (`handoffToken`), e não no
 *   navegador. O visitante continua conhecendo só o id da sessão daqui.
 *
 * Nada aqui lança: toda falha vira `{ ok: false, motivo }`. O site tem de
 * continuar de pé com o Órbita fora do ar — quem chama decide o que oferecer
 * no lugar (formulário, WhatsApp).
 */

/**
 * O endereço do Órbita. Vem do ambiente e de mais lugar nenhum. Exportado
 * porque o ASTRO CHAT do site (`features/site/server/astro-chat.ts`) fala com
 * o mesmo servidor.
 */
export const SERVIDOR_DO_CHAT = (
  process.env.ORBITA_ASTRO_CHAT_URL ??
  process.env.NEXT_PUBLIC_ORBITA_URL ??
  "https://orbita.nasaex.com"
).replace(/\/$/, "");

/** A chave pública do site cadastrado no app ASTRO CHAT do Órbita. */
const CHAVE = process.env.ORBITA_ASTRO_CHAT_KEY ?? "";

/**
 * O domínio do site, como o Órbita o conhece. Tem de estar entre os
 * permitidos do cadastro de lá, ou a rota recusa.
 */
export const DOMINIO_DO_SITE =
  process.env.ORBITA_ASTRO_CHAT_ORIGIN ?? "https://orbitatec.com.br";

const CABECALHO_DO_VISITANTE = "x-astro-visitor";

/** O Chat responde em milissegundos; mais que isto é o Órbita com problema. */
const TIMEOUT_MS = 8_000;

export type MotivoDaFalha =
  /** Falta a chave no ambiente: a ponte nem tenta. */
  | "nao_configurado"
  /** A sessão daqui não existe, expirou ou nunca pediu atendimento. */
  | "sem_atendimento"
  /** O Chat segurou por excesso de mensagens. */
  | "limite"
  /** Rede, tempo esgotado, site pausado no Órbita ou resposta fora do formato. */
  | "indisponivel";

export type Falha = { ok: false; motivo: MotivoDaFalha };

export function atendimentoConfigurado(): boolean {
  return CHAVE.length > 0;
}

type Chamada = {
  metodo: "GET" | "POST";
  caminho: string;
  corpo?: unknown;
  token?: string;
  /** O IP do visitante, para as travas de lá contarem por pessoa. */
  ip?: string | null;
};

async function chamar(
  chamada: Chamada,
): Promise<{ ok: true; dados: unknown } | Falha> {
  if (!atendimentoConfigurado())
    return { ok: false, motivo: "nao_configurado" };

  let resposta: Response;
  try {
    resposta = await fetch(
      `${SERVIDOR_DO_CHAT}/api/astro-chat/${CHAVE}${chamada.caminho}`,
      {
        method: chamada.metodo,
        headers: {
          origin: DOMINIO_DO_SITE,
          ...(chamada.corpo ? { "content-type": "application/json" } : {}),
          ...(chamada.token ? { [CABECALHO_DO_VISITANTE]: chamada.token } : {}),
          ...(chamada.ip ? { "x-forwarded-for": chamada.ip } : {}),
        },
        body: chamada.corpo ? JSON.stringify(chamada.corpo) : undefined,
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
  } catch (erro) {
    console.error("[astro-atendimento] sem_resposta", chamada.caminho, erro);
    return { ok: false, motivo: "indisponivel" };
  }

  if (resposta.status === 429) return { ok: false, motivo: "limite" };
  if (!resposta.ok) {
    // 403 é o caso que alguém precisa ver no log: domínio fora da lista, site
    // pausado ou sem tracking. Nenhum deles se resolve tentando de novo.
    console.error(
      "[astro-atendimento] recusado",
      chamada.caminho,
      resposta.status,
      await resposta.text().catch(() => ""),
    );
    return { ok: false, motivo: "indisponivel" };
  }

  const dados = await resposta.json().catch(() => null);
  return { ok: true, dados };
}

function idDaMensagem(dados: unknown): string | null {
  if (typeof dados !== "object" || dados === null) return null;
  const mensagem = (dados as { message?: unknown }).message;
  if (typeof mensagem !== "object" || mensagem === null) return null;
  const id = (mensagem as { id?: unknown }).id;
  return typeof id === "string" ? id : null;
}

async function abrirVisitante(
  pagina: string | undefined,
  ip: string | null | undefined,
): Promise<{ ok: true; token: string } | Falha> {
  const sessao = await chamar({
    metodo: "POST",
    caminho: "/session",
    corpo: pagina ? { pageUrl: pagina.slice(0, 500) } : {},
    ip,
  });
  if (!sessao.ok) return sessao;
  const token =
    typeof sessao.dados === "object" && sessao.dados !== null
      ? (sessao.dados as { token?: unknown }).token
      : null;
  if (typeof token !== "string" || token.length === 0) {
    return { ok: false, motivo: "indisponivel" };
  }
  return { ok: true, token };
}

/**
 * Passa a conversa para a equipe.
 *
 * Abre o visitante no Chat, manda o pedido e só então marca a sessão: se a
 * mensagem não chegou, a sessão continua do Astro e o visitante não fica
 * falando com ninguém.
 *
 * Chamada duas vezes na mesma sessão (o visitante insistiu, o modelo chamou a
 * tool de novo), a segunda só acrescenta a mensagem à conversa que já existe.
 *
 * Devolve o `cursor`: o id da mensagem recém-criada, a partir do qual o widget
 * passa a buscar as respostas.
 */
export async function abrirAtendimento(entrada: {
  sessaoId: string;
  pedido: string;
  pagina?: string;
  ip?: string | null;
}): Promise<{ ok: true; cursor: string } | Falha> {
  if (!atendimentoConfigurado())
    return { ok: false, motivo: "nao_configurado" };

  const sessao = await prisma.siteChatSession.findFirst({
    where: {
      id: entrada.sessaoId,
      channel: "SITE",
      expiresAt: { gt: new Date() },
    },
    select: { id: true, handoffToken: true },
  });
  if (!sessao) return { ok: false, motivo: "sem_atendimento" };

  let token = sessao.handoffToken;
  if (!token) {
    const visitante = await abrirVisitante(entrada.pagina, entrada.ip);
    if (!visitante.ok) return visitante;
    token = visitante.token;
  }

  const envio = await chamar({
    metodo: "POST",
    caminho: "/messages",
    corpo: { body: cortar(entrada.pedido) },
    token,
    ip: entrada.ip,
  });
  if (!envio.ok) return envio;
  const cursor = idDaMensagem(envio.dados);
  if (!cursor) return { ok: false, motivo: "indisponivel" };

  if (!sessao.handoffToken) {
    await prisma.siteChatSession.update({
      where: { id: sessao.id },
      data: { handoffToken: token, handoffAt: new Date() },
      select: { id: true },
    });
  }
  return { ok: true, cursor };
}

async function tokenDaSessao(sessaoId: string): Promise<string | null> {
  const sessao = await prisma.siteChatSession.findFirst({
    where: {
      id: sessaoId,
      channel: "SITE",
      expiresAt: { gt: new Date() },
    },
    select: { handoffToken: true },
  });
  return sessao?.handoffToken ?? null;
}

/** Uma mensagem do visitante, com a conversa já na mão da equipe. */
export async function enviarParaAEquipe(entrada: {
  sessaoId: string;
  texto: string;
  ip?: string | null;
}): Promise<{ ok: true; id: string } | Falha> {
  const token = await tokenDaSessao(entrada.sessaoId);
  if (!token) return { ok: false, motivo: "sem_atendimento" };

  const envio = await chamar({
    metodo: "POST",
    caminho: "/messages",
    corpo: { body: cortar(entrada.texto) },
    token,
    ip: entrada.ip,
  });
  if (!envio.ok) return envio;
  const id = idDaMensagem(envio.dados);
  if (!id) return { ok: false, motivo: "indisponivel" };

  await prisma.siteChatSession.update({
    where: { id: entrada.sessaoId },
    data: { messageCount: { increment: 1 } },
    select: { id: true },
  });
  return { ok: true, id };
}

/** O que a equipe respondeu desde o cursor. */
export async function lerRespostasDaEquipe(entrada: {
  sessaoId: string;
  depois: string | null;
}): Promise<
  { ok: true; respostas: RespostaDaEquipe[]; cursor: string | null } | Falha
> {
  const token = await tokenDaSessao(entrada.sessaoId);
  if (!token) return { ok: false, motivo: "sem_atendimento" };

  const consulta = await chamar({
    metodo: "GET",
    caminho: entrada.depois
      ? `/messages?after=${encodeURIComponent(entrada.depois)}`
      : "/messages",
    token,
  });
  if (!consulta.ok) return consulta;

  const lido = lerMensagens(consulta.dados);
  return {
    ok: true,
    respostas: lido.respostas,
    // Sem novidade o cursor fica onde estava: devolver null faria a próxima
    // consulta recomeçar do início da conversa.
    cursor: lido.cursor ?? entrada.depois,
  };
}
