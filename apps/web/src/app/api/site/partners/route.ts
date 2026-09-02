import { NextResponse } from "next/server";
import { getPublicSitePartners } from "@/features/site/server/public-partners";

/**
 * Os parceiros e as marcas do site institucional, para o `apps/site` consumir.
 *
 * Rota ABERTA de propósito, como as outras `/api/site/*`: é o mesmo conteúdo
 * que qualquer visitante vê. Não devolve o que está escondido, não devolve
 * quem editou.
 *
 * CORS liberado porque o site roda em outro domínio; sem credenciais, então
 * não há sessão para vazar.
 */
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET() {
  try {
    const data = await getPublicSitePartners();
    return NextResponse.json(data, { headers: CORS });
  } catch (error) {
    // Tabela ainda não migrada, banco fora do ar: o site trata a falha tirando
    // a seção da viagem, que é melhor do que meia seção.
    console.error("[site] falha ao listar parceiros e marcas", error);
    return NextResponse.json(
      { error: "conteúdo indisponível" },
      { status: 503, headers: CORS },
    );
  }
}
