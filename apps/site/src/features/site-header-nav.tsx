"use client";

import type { SiteContent } from "@nerp/site-content";
import { Nav } from "@/orbita/ui/nav";
import { SiteContentProvider } from "@/orbita/lib/content-context";
import { AstroWidget } from "@/features/astro/astro-widget";
import type { PaginaDoAstro } from "@/features/astro/pagina";
// O `o-nav` e o mega menu são estilizados pelo CSS da órbita. As páginas
// internas não carregam a cena, então o CSS precisa vir junto do menu.
import "@/orbita/orbita.css";

/**
 * O menu principal — o MESMO da home — nas páginas internas.
 *
 * O `<Nav>` da órbita é reaproveitado inteiro, em modo `standalone`: os
 * painéis com ícones (Soluções, Segmentos, Sobre) são idênticos porque só
 * dependem dos `href` que o catálogo já resolve. O que muda é que aqui os
 * itens de âncora navegam de verdade, em vez de viajar pela cena 3D.
 *
 * O `SiteContentProvider` é obrigatório: o Nav e o mega menu leem o whatsapp e
 * o destaque de "Sobre" pelo contexto. Sem ele, cairiam no conteúdo padrão.
 */
export function SiteHeaderNav({
  content,
  loginHref,
  pagina,
}: {
  content: SiteContent;
  loginHref: string;
  pagina?: PaginaDoAstro;
}) {
  return (
    <SiteContentProvider content={content}>
      <Nav ctaHref={loginHref} signupHref={loginHref} standalone />
      {/* O consultor acompanha a página interna: é lendo sobre uma ferramenta
          que a dúvida aparece. */}
      <AstroWidget pagina={pagina} />
    </SiteContentProvider>
  );
}
