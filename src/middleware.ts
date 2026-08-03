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
    pathname.startsWith("/tradegram")
  ) {
    return NextResponse.next();
  }

  // Ignora rotas do dashboard

  if (
    pathname.startsWith("/produtos") ||
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
    pathname.startsWith("/colaboradores")
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
