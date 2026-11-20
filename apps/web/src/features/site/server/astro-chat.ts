import "server-only";

import type { AstroChatDoSite } from "@nerp/site-content";
import {
  DOMINIO_DO_SITE,
  SERVIDOR_DO_CHAT,
} from "@/features/astro-consultor/server/atendimento";
import prisma from "@/lib/db";
import { ASTRO_CHAT_KEY, lerAstroChatGuardado } from "./astro-chat-codigo";

/**
 * O ASTRO CHAT do Órbita no site: o que está salvo e se está valendo lá.
 *
 * O endereço do Órbita e o domínio do site saem do mesmo lugar que a ponte do
 * atendimento humano usa (`atendimento.ts`) — são a mesma instalação vista de
 * dois ângulos, e duas cópias dessas constantes divergiriam no primeiro ajuste
 * de ambiente.
 */

const TIMEOUT_MS = 8_000;

/** O que o site precisa para carregar o widget; `null` sem código colado. */
export async function astroChatDoSite(): Promise<AstroChatDoSite | null> {
  const linha = await prisma.siteSetting.findUnique({
    where: { key: ASTRO_CHAT_KEY },
    select: { value: true },
  });
  const guardado = lerAstroChatGuardado(linha?.value);
  return guardado
    ? { servidor: SERVIDOR_DO_CHAT, chave: guardado.chave }
    : null;
}

export type TesteDoAstroChat =
  | { ok: true; empresa: string | null; assistente: string | null }
  | {
      ok: false;
      motivo: /** O Órbita não conhece esta chave: código errado, ou foi trocada lá. */
        | "chave_desconhecida"
        /** O domínio do site não está na lista de permitidos do cadastro. */
        | "dominio_nao_permitido"
        /** O site está desligado, sem ★ ou com a conta suspensa. */
        | "pausado"
        /** O cadastro não tem tracking de destino. */
        | "sem_tracking"
        | "indisponivel";
    };

/**
 * Confere uma chave contra o Órbita, sem criar nada lá.
 *
 * Usa a rota de configuração do widget: ela passa pelo mesmo portão das
 * mensagens (chave, domínio, site ligado, tracking) e não grava lead nem
 * visitante. É o que o admin vê logo depois de colar o código — descobrir que
 * o domínio não bate só quando o widget não aparecer no site seria tarde.
 *
 * A chamada sai do servidor, então o `Origin` é mandado à mão com o domínio
 * do site: é contra ele que o Órbita confere a lista de permitidos.
 */
export async function testarAstroChat(
  chave: string,
): Promise<TesteDoAstroChat> {
  let resposta: Response;
  try {
    resposta = await fetch(
      `${SERVIDOR_DO_CHAT}/api/astro-chat/${chave}/config`,
      {
        headers: { origin: DOMINIO_DO_SITE },
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
  } catch {
    return { ok: false, motivo: "indisponivel" };
  }

  const dados = (await resposta.json().catch(() => null)) as {
    error?: unknown;
    companyName?: unknown;
    assistantName?: unknown;
  } | null;

  if (resposta.ok) {
    return {
      ok: true,
      empresa:
        typeof dados?.companyName === "string" ? dados.companyName : null,
      assistente:
        typeof dados?.assistantName === "string" ? dados.assistantName : null,
    };
  }

  if (resposta.status === 404) {
    return { ok: false, motivo: "chave_desconhecida" };
  }
  if (dados?.error === "origin_not_allowed") {
    return { ok: false, motivo: "dominio_nao_permitido" };
  }
  if (dados?.error === "paused") return { ok: false, motivo: "pausado" };
  if (dados?.error === "not_configured") {
    return { ok: false, motivo: "sem_tracking" };
  }
  return { ok: false, motivo: "indisponivel" };
}
