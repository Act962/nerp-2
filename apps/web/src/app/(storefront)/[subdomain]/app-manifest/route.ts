import prisma from "@/lib/db";
import { constructUrl } from "@/hooks/use-construct-url";
import {
  TEMA_PADRAO_CATALOGO,
  isHexValido,
} from "@/features/storefront/lib/cores";

/**
 * Ficha de app (Web App Manifest) da vitrine: instalada pelo "Adicionar à tela
 * inicial", a loja abre em tela cheia, sem a barra do navegador, com o nome, a
 * logo e a cor dela. Sem extensão no caminho de propósito: o middleware não
 * reescreve arquivos com extensão, e o modo `/catalogo/<slug>` precisa dele.
 * `start_url`/`scope` relativos resolvem a partir deste endereço — servem tanto
 * em `loja.dominio.com` quanto em `dominio.com/catalogo/<slug>`.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ subdomain: string }> },
) {
  const { subdomain } = await params;
  const org = await prisma.organization.findUnique({
    where: { subdomain, verifiedAt: { not: null } },
    select: {
      name: true,
      catalogSettings: {
        select: {
          metaTitle: true,
          logo: true,
          theme: true,
          backgroundColor: true,
        },
      },
    },
  });
  if (!org?.catalogSettings) {
    return new Response("Not found", { status: 404 });
  }

  const settings = org.catalogSettings;
  const nome = settings.metaTitle || org.name;
  const tema = isHexValido(settings.theme) ? settings.theme : TEMA_PADRAO_CATALOGO;
  const fundo = isHexValido(settings.backgroundColor)
    ? settings.backgroundColor
    : "#ffffff";
  const logo = constructUrl(settings.logo ?? "");

  const manifest = {
    name: nome,
    short_name: nome.length > 12 ? nome.split(/\s+/)[0] : nome,
    description: `Catálogo de ${nome}`,
    start_url: "./",
    scope: "./",
    display: "standalone",
    orientation: "portrait",
    lang: "pt-BR",
    theme_color: tema,
    background_color: fundo,
    icons: logo
      ? [
          { src: logo, sizes: "192x192", purpose: "any" },
          { src: logo, sizes: "512x512", purpose: "any" },
        ]
      : [
          { src: "/logo.png", sizes: "192x192", type: "image/png" },
          { src: "/logo.png", sizes: "512x512", type: "image/png" },
        ],
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      "content-type": "application/manifest+json; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
