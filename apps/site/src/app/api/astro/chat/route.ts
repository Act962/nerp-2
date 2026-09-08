import type { NextRequest } from "next/server";

/**
 * O proxy do consultor.
 *
 * O browser do visitante fala com esta rota, no mesmo domínio do site; ela
 * repassa para o `apps/web`, que tem o banco, as chaves de IA e as travas.
 *
 * Por que proxy e não CORS: as três rotas `/api/site/*` de conteúdo podem ser
 * `Access-Control-Allow-Origin: *` porque são GET idempotentes. A do chat
 * grava lead e gasta token de LLM — aberta ao mundo, é conta de API de
 * qualquer um. Com o proxy, o segredo fica no servidor do site, não há
 * preflight, e o browser nunca sabe o endereço real.
 *
 * O corpo é repassado como stream, sem bufferizar: quem está lendo vê o texto
 * aparecer palavra a palavra, como deve ser.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

/** O ERP pode demorar para o primeiro token; depois disso o stream é vivo. */
const TIMEOUT_MS = 60_000;

/**
 * O que o visitante vê quando o `apps/web` não responde.
 *
 * É 200, não 500, e no formato de stream que o widget já sabe ler: o site
 * segue de pé com o ERP fora do ar, que é a regra desta casa — a mesma que
 * `lib/api.ts` aplica ao conteúdo com o `DEFAULT_CONTENT`.
 */
function respostaDeReserva(texto: string): Response {
  const id = "fallback";
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
      "x-astro-fallback": "1",
    },
  });
}

const FORA_DO_AR =
  "Não consegui responder agora. Se puder, chame a gente no WhatsApp que continuamos por lá.";

export async function POST(request: NextRequest) {
  const corpo = await request.text();

  let resposta: Response;
  try {
    resposta = await fetch(`${APP_URL}/api/site/astro/chat`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.SITE_ASTRO_TOKEN
          ? { "x-site-token": process.env.SITE_ASTRO_TOKEN }
          : {}),
        // O IP real do visitante, para as travas por visitante contarem certo
        // do outro lado — daqui em diante o IP de origem seria o do servidor.
        ...(request.headers.get("x-forwarded-for")
          ? {
              "x-forwarded-for": request.headers.get(
                "x-forwarded-for",
              ) as string,
            }
          : {}),
        ...(request.headers.get("user-agent")
          ? { "user-agent": request.headers.get("user-agent") as string }
          : {}),
      },
      body: corpo,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return respostaDeReserva(FORA_DO_AR);
  }

  // 429 e 503 carregam mensagem própria — a trava que disparou sabe explicar
  // melhor do que um texto genérico.
  if (!resposta.ok) {
    const detalhe = await resposta.json().catch(() => null);
    const mensagem =
      (detalhe as { mensagem?: string } | null)?.mensagem ?? FORA_DO_AR;
    return respostaDeReserva(mensagem);
  }

  if (!resposta.body) return respostaDeReserva(FORA_DO_AR);

  return new Response(resposta.body, {
    headers: {
      "content-type":
        resposta.headers.get("content-type") ?? "text/event-stream",
      "cache-control": "no-cache",
      "x-vercel-ai-ui-message-stream": "v1",
      "x-robots-tag": "noindex",
      ...(resposta.headers.get("x-astro-session")
        ? {
            "x-astro-session": resposta.headers.get(
              "x-astro-session",
            ) as string,
          }
        : {}),
    },
  });
}
