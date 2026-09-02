import { NextResponse } from "next/server";
import { getPublicSiteContent } from "@/features/site/server/public-content";

/**
 * O conteúdo publicado do site institucional, para o `apps/site` consumir.
 *
 * Rota ABERTA de propósito: é o mesmo conteúdo que qualquer visitante vê na
 * página. Não devolve rascunho, não devolve quem editou, não devolve acesso.
 *
 * CORS liberado porque o site roda em outro domínio e pode buscar isto do
 * navegador; sem credenciais, então não há sessão para vazar.
 */
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  // 60s de borda com 5min de "serve o antigo enquanto revalida": o menu muda
  // de vez em quando, e o site não pode ficar esperando este app a cada visita.
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET() {
  try {
    const content = await getPublicSiteContent();
    return NextResponse.json(content, { headers: CORS });
  } catch (error) {
    // Tabela ainda não migrada, banco fora do ar: o site tem o próprio
    // conteúdo de reserva, e prefere um 503 claro a um JSON pela metade.
    console.error("[site] falha ao montar o conteúdo público", error);
    return NextResponse.json(
      { error: "conteúdo indisponível" },
      { status: 503, headers: CORS },
    );
  }
}
