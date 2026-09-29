import { coletaSchema } from "@nerp/site-content";
import { type NextRequest, NextResponse } from "next/server";
import {
  ehRobo,
  registrarColeta,
} from "@/features/site/server/metricas-coleta";
import { tokenDoSiteConfere } from "@/features/site/server/token-do-site";

/**
 * A coleta de métricas do site institucional.
 *
 * Mesmo desenho do chat do Astro: sem CORS, chamada só pelo proxy do
 * `apps/site` com o `SITE_ASTRO_TOKEN`. Aberta ao mundo, qualquer script
 * encheria o painel de visita inventada.
 *
 * Responde 204 até quando descarta — o navegador não tem o que fazer com um
 * erro de métrica, e um 4xx só viraria ruído no console do visitante.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!tokenDoSiteConfere(request.headers.get("x-site-token"))) {
    return NextResponse.json({ erro: "nao_autorizado" }, { status: 401 });
  }
  if (ehRobo(request.headers.get("user-agent"))) {
    return new NextResponse(null, { status: 204 });
  }

  const corpo = coletaSchema.safeParse(await request.json().catch(() => null));
  if (!corpo.success) return new NextResponse(null, { status: 204 });

  try {
    await registrarColeta(corpo.data);
  } catch (error) {
    console.error("[site] falha ao gravar métricas", error);
  }
  return new NextResponse(null, { status: 204 });
}
