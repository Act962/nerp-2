import { NextResponse } from "next/server";
import prisma from "@/lib/db";

// Miniatura do catálogo promocional no cartão de ofertas da vitrine. Fica
// fora da configuração pública: são dezenas de KB por catálogo, e por aqui o
// navegador guarda a imagem em cache. Só responde o que a loja já mostra na
// vitrine: botão de ofertas ligado, catálogo escolhido e link público ativo.
const DATA_URL_DE_IMAGEM = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/;
const CACHE_SEGUNDOS = 300;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ subdomain: string; token: string }> },
) {
  const { subdomain, token } = await params;

  const organization = await prisma.organization.findUnique({
    where: { subdomain, verifiedAt: { not: null } },
    select: {
      id: true,
      catalogSettings: {
        select: { showOffersButton: true, offerCatalogIds: true },
      },
    },
  });
  const settings = organization?.catalogSettings;
  if (!organization || !settings?.showOffersButton) {
    return new NextResponse(null, { status: 404 });
  }

  const catalogos = await prisma.promotionalCatalog.findMany({
    where: {
      organizationId: organization.id,
      id: { in: settings.offerCatalogIds },
      thumbnail: { not: null },
    },
    select: { config: true, thumbnail: true },
  });
  const catalogo = catalogos.find(
    (atual) =>
      (atual.config as { shareToken?: unknown } | null)?.shareToken === token,
  );
  const partes = catalogo?.thumbnail?.match(DATA_URL_DE_IMAGEM);
  if (!partes) return new NextResponse(null, { status: 404 });

  const [, tipo, base64] = partes;
  return new NextResponse(Buffer.from(base64, "base64"), {
    headers: {
      "Content-Type": tipo,
      "Cache-Control": `public, max-age=${CACHE_SEGUNDOS}`,
    },
  });
}
