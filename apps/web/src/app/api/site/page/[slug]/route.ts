import { NextResponse } from "next/server";
import { lerAstroPagina, parseBlocks } from "@nerp/site-content";
import prisma from "@/lib/db";

/**
 * Uma página interna publicada, para o `apps/site` renderizar.
 *
 * Só o que está NO AR sai daqui: `publishedBlocks`, nunca o rascunho. Uma
 * página em rascunho responde 404 — do ponto de vista de quem está de fora,
 * ela ainda não existe.
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

const SECOES = {
  solucoes: "SOLUCOES",
  segmentos: "SEGMENTOS",
  sobre: "SOBRE",
} as const;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  // A seção faz parte da identidade da página: sem ela, /solucoes/<slug> e
  // /segmentos/<slug> devolveriam a mesma coisa e o endereço existiria em
  // dois lugares.
  const pedida = new URL(request.url).searchParams.get("section");
  const section = SECOES[pedida as keyof typeof SECOES] ?? undefined;

  try {
    const page = await prisma.sitePage.findFirst({
      where: { slug, section, status: "PUBLISHED" },
      select: {
        slug: true,
        title: true,
        publishedBlocks: true,
        astroPublished: true,
        seoTitle: true,
        seoDescription: true,
        ogImage: true,
      },
    });

    if (!page) {
      return NextResponse.json(
        { error: "não encontrada" },
        { status: 404, headers: CORS },
      );
    }

    return NextResponse.json(
      {
        slug: page.slug,
        title: page.title,
        seoTitle: page.seoTitle ?? "",
        seoDescription: page.seoDescription ?? "",
        ogImage: page.ogImage ?? "",
        // Validado aqui, e não do outro lado: quem guardou o JSON é quem sabe
        // descartar o bloco que não bate mais com o formato.
        blocks: parseBlocks(page.publishedBlocks),
        // O que o Astro fala aqui. Validado no mesmo lugar e pelo mesmo
        // motivo dos blocos: quem guardou o JSON é quem sabe descartá-lo.
        astro: lerAstroPagina(page.astroPublished),
      },
      { headers: CORS },
    );
  } catch (error) {
    console.error("[site] falha ao ler a página", slug, error);
    return NextResponse.json(
      { error: "página indisponível" },
      { status: 503, headers: CORS },
    );
  }
}
