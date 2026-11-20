import type { NextRequest } from "next/server";

/**
 * O proxy do atendimento humano.
 *
 * Mesma razão do proxy do chat (`../chat/route.ts`): o navegador fala com o
 * próprio site, e o site repassa ao `apps/web` com o segredo. Aqui não há
 * stream — é JSON de ida e de volta —, então o corpo é repassado como veio.
 *
 * Quando o `apps/web` não responde, devolve 503 e o widget mostra a saída que
 * sempre funciona, o WhatsApp. O site não cai junto.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

const TIMEOUT_MS = 15_000;

function cabecalhos(request: NextRequest): Record<string, string> {
  const encaminhado = request.headers.get("x-forwarded-for");
  const agente = request.headers.get("user-agent");
  return {
    ...(process.env.SITE_ASTRO_TOKEN
      ? { "x-site-token": process.env.SITE_ASTRO_TOKEN }
      : {}),
    // O IP real do visitante: daqui em diante o de origem seria o do servidor,
    // e as travas por pessoa contariam todo mundo como um só.
    ...(encaminhado ? { "x-forwarded-for": encaminhado } : {}),
    ...(agente ? { "user-agent": agente } : {}),
  };
}

function foraDoAr(): Response {
  return Response.json({ erro: "indisponivel" }, { status: 503 });
}

async function repassar(resposta: Response): Promise<Response> {
  return new Response(await resposta.text(), {
    status: resposta.status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const resposta = await fetch(`${APP_URL}/api/site/astro/atendimento`, {
      method: "POST",
      headers: { "content-type": "application/json", ...cabecalhos(request) },
      body: await request.text(),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return await repassar(resposta);
  } catch {
    return foraDoAr();
  }
}

export async function GET(request: NextRequest) {
  // Só os dois parâmetros que a rota de lá conhece: o resto da query não tem
  // por que atravessar.
  const consulta = new URLSearchParams();
  const sessao = request.nextUrl.searchParams.get("sessionId");
  const depois = request.nextUrl.searchParams.get("after");
  if (sessao) consulta.set("sessionId", sessao);
  if (depois) consulta.set("after", depois);

  try {
    const resposta = await fetch(
      `${APP_URL}/api/site/astro/atendimento?${consulta.toString()}`,
      {
        headers: cabecalhos(request),
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    return await repassar(resposta);
  } catch {
    return foraDoAr();
  }
}
