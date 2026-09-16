import { type AstroAnimacao, lerAnimacao } from "@nerp/site-content";
import { NextResponse } from "next/server";
import prisma from "@/lib/db";

/**
 * As animações do ASTRO que estão no ar, para o `apps/site` desenhar.
 *
 * Rota ABERTA, como `/api/site/content`: é o mesmo mascote que qualquer
 * visitante vê. Só sai o que tem MOMENTO — cena sem momento é rascunho do
 * editor e não existe para fora daqui.
 *
 * A resposta é um mapa momento → cena, e não uma lista, porque é assim que
 * quem desenha pergunta. Cena num formato que o Zod não reconhece fica de
 * fora em silêncio: a tela perde o mascote naquele ponto e segue inteira.
 */
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  // Mesmo intervalo de `/api/site/content`: animação muda de vez em quando, e
  // o site não pode esperar este app a cada visita.
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET() {
  try {
    const linhas = await prisma.siteAstroAnimacao.findMany({
      where: { momento: { not: null } },
      select: { momento: true, cena: true },
    });

    const momentos: Record<string, AstroAnimacao> = {};
    for (const linha of linhas) {
      if (!linha.momento) continue;
      const cena = lerAnimacao(linha.cena);
      if (cena) momentos[linha.momento] = cena;
    }

    return NextResponse.json({ momentos }, { headers: CORS });
  } catch (error) {
    // Tabela ainda não migrada, banco fora do ar: o site trata a falha tirando
    // o mascote da tela, e continua de pé.
    console.error("[site] falha ao listar as animações do ASTRO", error);
    return NextResponse.json(
      { error: "animações indisponíveis" },
      { status: 503, headers: CORS },
    );
  }
}
