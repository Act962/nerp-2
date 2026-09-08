import { NextResponse } from "next/server";
import prisma from "@/lib/db";

/**
 * O índice das páginas publicadas, para o sitemap do `apps/site`.
 *
 * Sem esta rota o sitemap só saberia das páginas que nascem do código, e as
 * criadas no admin — justamente as que o cliente escreve — ficariam de fora do
 * arquivo que o Google lê para descobrir endereços.
 *
 * Devolve MENOS do que as outras `/api/site/*`: só seção, slug e a data da
 * publicação. Nada de bloco, nada de rascunho, nada de quem editou — é uma
 * lista de endereços que qualquer visitante já poderia montar navegando.
 *
 * Rota ABERTA e com CORS liberado, pelo mesmo motivo das irmãs: é conteúdo
 * público, GET idempotente, sem credenciais.
 */
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/** O enum do banco no vocabulário da URL — o mesmo mapa de `page/[slug]`. */
const SECAO_NA_URL = {
  SOLUCOES: "solucoes",
  SEGMENTOS: "segmentos",
  SOBRE: "sobre",
} as const;

export async function GET() {
  try {
    const pages = await prisma.sitePage.findMany({
      where: { status: "PUBLISHED" },
      select: {
        slug: true,
        section: true,
        publishedAt: true,
        updatedAt: true,
      },
      orderBy: { slug: "asc" },
    });

    return NextResponse.json(
      {
        pages: pages.map((page) => ({
          section: SECAO_NA_URL[page.section],
          slug: page.slug,
          // `publishedAt` e não `updatedAt`: o que interessa ao sitemap é
          // quando o conteúdo MUDOU NO AR. Um rascunho salvo dez vezes hoje
          // não é uma alteração que o visitante — ou o buscador — viu.
          lastModified: (page.publishedAt ?? page.updatedAt).toISOString(),
        })),
      },
      { headers: CORS },
    );
  } catch (error) {
    // Banco fora do ar ou tabela ainda não migrada: o site cai no índice que
    // ele mesmo tem, como faz com todo o resto do conteúdo.
    console.error("[site] falha ao listar as páginas publicadas", error);
    return NextResponse.json(
      { error: "índice indisponível" },
      { status: 503, headers: CORS },
    );
  }
}
