import { createHash } from "node:crypto";
import prisma from "@/lib/db";

/**
 * As travas do consultor.
 *
 * Uma rota pública que chama LLM é conta de API aberta na internet. O
 * precedente do Órbita usa um `Map` no `globalThis`, e o próprio autor anotou
 * que aquilo não serve para mais de uma instância — o que é o caso aqui, no
 * Coolify. Então o limite conta linhas no Postgres, pelo índice
 * `(ipHash, createdAt)` que a migração criou para isto.
 *
 * São três travas, e cada uma cobre o que a outra não vê:
 *  - por SESSÃO, contra a conversa infinita de um visitante só;
 *  - por IP na hora e no dia, contra o script que abre sessão atrás de sessão;
 *  - por DIA no site inteiro (`astro-config`), que é o botão de desligar sem
 *    deploy quando algo escapar das duas primeiras.
 */

export const LIMITES = {
  mensagensPorSessao: 30,
  sessoesPorHoraPorIp: 5,
  mensagensPorDiaPorIp: 60,
} as const;

export type MotivoBloqueio =
  | "sessao_esgotada"
  | "muitas_sessoes"
  | "cota_diaria"
  | "teto_do_site";

export type Veredito =
  | { ok: true }
  | { ok: false; motivo: MotivoBloqueio; mensagem: string };

const MENSAGENS: Record<MotivoBloqueio, string> = {
  sessao_esgotada:
    "Esta conversa já foi longe — para não perder o fio, o melhor agora é falar com alguém do time.",
  muitas_sessoes:
    "Você abriu várias conversas em pouco tempo. Continue nesta ou fale com o time.",
  cota_diaria:
    "Por hoje já conversamos bastante. Se ficou algo em aberto, fale com o time.",
  teto_do_site:
    "O Astro está descansando no momento. Fale com o time que a gente continua daqui.",
};

function bloqueio(motivo: MotivoBloqueio): Veredito {
  return { ok: false, motivo, mensagem: MENSAGENS[motivo] };
}

/**
 * O IP nunca é guardado cru. O hash é estável, então a contagem por visitante
 * funciona igual — e um vazamento do banco não entrega endereço de ninguém.
 *
 * O sal vem do ambiente. Sem ele, o hash de um IPv4 é quebrável por força
 * bruta em segundos (são só 4 bilhões), o que faria a coluna ser, na prática,
 * o IP em claro.
 */
export function hashDeIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const sal = process.env.SITE_ASTRO_IP_SALT;
  if (!sal) return null;
  return createHash("sha256").update(`${sal}:${ip}`).digest("hex");
}

/** O IP do visitante atrás do proxy do site e do Coolify. */
export function ipDaRequisicao(headers: Headers): string | null {
  const encaminhado = headers.get("x-forwarded-for");
  if (encaminhado) {
    const primeiro = encaminhado.split(",")[0]?.trim();
    if (primeiro) return primeiro;
  }
  return headers.get("x-real-ip") ?? null;
}

export type SessaoParaLimite = {
  messageCount: number;
} | null;

/**
 * Decide se esta mensagem pode passar.
 *
 * Chamada ANTES de abrir o stream, e o contador é incrementado logo depois —
 * uma requisição que trave no modelo já contou, senão a trava não segura um
 * cliente que desiste e reenvia.
 */
export async function verificarLimite(entrada: {
  ipHash: string | null;
  sessao: SessaoParaLimite;
  tetoMensagensDia?: number;
}): Promise<Veredito> {
  if (
    entrada.sessao &&
    entrada.sessao.messageCount >= LIMITES.mensagensPorSessao
  ) {
    return bloqueio("sessao_esgotada");
  }

  const agora = Date.now();
  const umaHora = new Date(agora - 60 * 60 * 1000);
  const umDia = new Date(agora - 24 * 60 * 60 * 1000);

  if (entrada.tetoMensagensDia && entrada.tetoMensagensDia > 0) {
    const doSite = await prisma.siteChatSession.aggregate({
      _sum: { messageCount: true },
      where: { createdAt: { gte: umDia } },
    });
    if ((doSite._sum.messageCount ?? 0) >= entrada.tetoMensagensDia) {
      return bloqueio("teto_do_site");
    }
  }

  // Sem sal configurado não há hash, e sem hash não há como contar por
  // visitante. As travas de sessão e do site inteiro continuam valendo.
  if (!entrada.ipHash) return { ok: true };

  const [sessoesRecentes, mensagensDoDia] = await Promise.all([
    prisma.siteChatSession.count({
      where: { ipHash: entrada.ipHash, createdAt: { gte: umaHora } },
    }),
    prisma.siteChatSession.aggregate({
      _sum: { messageCount: true },
      where: { ipHash: entrada.ipHash, createdAt: { gte: umDia } },
    }),
  ]);

  if (sessoesRecentes > LIMITES.sessoesPorHoraPorIp) {
    return bloqueio("muitas_sessoes");
  }
  if ((mensagensDoDia._sum.messageCount ?? 0) >= LIMITES.mensagensPorDiaPorIp) {
    return bloqueio("cota_diaria");
  }

  return { ok: true };
}
