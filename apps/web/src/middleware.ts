import { NextResponse } from "next/server";

import type { NextRequest } from "next/server";

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|login|register|auth).*)",
  ],
};

export function middleware(request: NextRequest) {
  const url = request.nextUrl;

  const hostname = request.headers.get("host") || "";

  const pathname = url.pathname;

  // ✅ Permite rotas de auth passarem

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/cadastro") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/accept-invitation") ||
    // Link aberto de entrada: sem isto, abrir por um subdomínio cairia na
    // reescrita de vitrine (/<subdominio>/entrar/...) e daria 404.
    pathname.startsWith("/entrar") ||
    // O app público do TradeGram vive na raiz e é o mesmo em qualquer domínio.
    // Sem esta linha, abri-lo por um subdomínio de inquilino seria reescrito
    // para /<subdominio>/tradegram/... e daria 404 — e é justamente o link que
    // as pessoas compartilham.
    pathname.startsWith("/tradegram") ||
    // Link público do Catálogo Promocional (/promocao/{token}). Aberto/deslogado
    // e compartilhável de qualquer domínio.
    pathname.startsWith("/promocao") ||
    // Celular como leitor (/leitor/{token}): aberto pelo QR do PDV, sem login.
    // Sem esta linha, abrir pelo subdomínio da loja cairia na reescrita de
    // vitrine e daria 404 — e é o único jeito de chegar nesta página.
    pathname.startsWith("/leitor") ||
    // Admin do site institucional. Caminho de topo novo: sem esta linha, abrir
    // por um subdomínio viraria /<subdominio>/site e daria 404.
    pathname.startsWith("/site") ||
    // Páginas internas das soluções, geradas pelo admin do site.
    pathname.startsWith("/solucoes")
  ) {
    return NextResponse.next();
  }

  // Catálogo público via caminho: /catalogo/{slug}[/rest] → reescreve
  // internamente pra /{slug}[/rest] e cai na mesma rota do storefront que o
  // modo subdomínio usa (`(storefront)/[subdomain]/...`).
  // Segmento único `/catalogo` continua sendo o admin autenticado.
  // Um header `x-catalog-base` é propagado pro layout do storefront saber
  // qual é o prefixo público — os <Link href> internos usam esse valor.
  const catalogPathMatch = pathname.match(
    /^\/catalogo\/([a-z0-9-]{3,})(\/.*)?$/i,
  );
  if (catalogPathMatch) {
    const slug = catalogPathMatch[1];
    const rest = catalogPathMatch[2] ?? "/";
    url.pathname = `/${slug}${rest === "/" ? "" : rest}`;
    const response = NextResponse.rewrite(url);
    response.headers.set("x-catalog-base", `/catalogo/${slug}`);
    return response;
  }

  // Ignora rotas do dashboard

  if (
    pathname.startsWith("/produtos") ||
    pathname.startsWith("/precos") ||
    pathname.startsWith("/estoque") ||
    pathname.startsWith("/vendas") ||
    pathname.startsWith("/compras") ||
    pathname.startsWith("/financeiro") ||
    pathname.startsWith("/clientes") ||
    pathname.startsWith("/fornecedores") ||
    pathname.startsWith("/catalogo") ||
    pathname.startsWith("/relatórios") ||
    pathname.startsWith("/configurações") ||
    pathname.startsWith("/registrar-pedido") ||
    pathname.startsWith("/pedido-cliente") ||
    pathname.startsWith("/ranking-publico") ||
    pathname.startsWith("/pedidos") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/dashboard-organizacao") ||
    pathname.startsWith("/publico/dashboard") ||
    pathname.startsWith("/integracoes") ||
    pathname.startsWith("/colaboradores") ||
    pathname.startsWith("/padroes") ||
    pathname.startsWith("/aplicativos") ||
    // Página de autorização de cancelamento aberta no celular do supervisor.
    pathname.startsWith("/autorizar")
  ) {
    return NextResponse.next();
  }

  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || "localhost:3000";

  const baseHostname = baseDomain.split(":")[0];

  const currentHostname = hostname.split(":")[0];

  const subdomain = getSubdomain(currentHostname, baseHostname);

  if (subdomain && subdomain !== "www" && subdomain !== "admin") {
    url.pathname = `/${subdomain}${pathname}`;

    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

function getSubdomain(hostname: string, baseDomain: string) {
  const cleanHostname = hostname.replace(/^www\./, "");

  const cleanBaseDomain = baseDomain.replace(/^www\./, "");

  if (cleanHostname === cleanBaseDomain) {
    return null;
  }

  if (cleanHostname.endsWith(`.${cleanBaseDomain}`)) {
    const subdomain = cleanHostname.slice(0, -(cleanBaseDomain.length + 1));

    if (/^[a-z0-9-]+$/.test(subdomain) && subdomain.length >= 3) {
      return subdomain;
    }
  }

  return null;
}
