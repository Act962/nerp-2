import type { NextRequest } from "next/server";

/**
 * O proxy da coleta de métricas.
 *
 * Mesma razão do proxy do Astro: a rota do `apps/web` grava no banco e fica
 * atrás do `SITE_ASTRO_TOKEN`. O navegador fala só com este domínio — o que,
 * de quebra, deixa a coleta de fora das listas de bloqueio que miram os
 * domínios de analytics conhecidos.
 *
 * Sempre 204 para o navegador: métrica perdida não é problema do visitante.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

/** Um beacon tem poucos KB; acima disso não é o nosso medidor. */
const TAMANHO_MAXIMO = 16 * 1024;

export async function POST(request: NextRequest) {
  const corpo = await request.text();
  if (!corpo || corpo.length > TAMANHO_MAXIMO) {
    return new Response(null, { status: 204 });
  }

  try {
    await fetch(`${APP_URL}/api/site/metricas`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.SITE_ASTRO_TOKEN
          ? { "x-site-token": process.env.SITE_ASTRO_TOKEN }
          : {}),
        // É pelo user-agent que o outro lado descarta robô.
        "user-agent": request.headers.get("user-agent") ?? "",
      },
      body: corpo,
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // ERP fora do ar: a visita não é contada, e o site segue.
  }
  return new Response(null, { status: 204 });
}
