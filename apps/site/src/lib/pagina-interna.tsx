import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { SiteSection } from "@nerp/site-content";
import { SiteProductPage } from "@/features/product-page";
import { APP_LINKS, getProductPage, getSiteContent } from "./api";
import {
  descricaoDaPagina,
  jsonLdScript,
  metadataDaPagina,
  paginaInternaLd,
  SECTION_LABEL,
} from "./seo";

/**
 * A rota de uma página interna, montada uma vez só.
 *
 * As três seções (`/solucoes`, `/segmentos`, `/sobre`) são a MESMA máquina: os
 * blocos publicados pelo admin, com fallback no código. O que mudava entre os
 * três arquivos era uma string — e três cópias de um `generateMetadata` é
 * exatamente como uma delas fica para trás quando o canonical muda.
 */

/** O caminho canônico de uma página interna. */
export function caminhoDaPagina(section: SiteSection, slug: string): string {
  return `/${section}/${slug}`;
}

export async function metadataDaPaginaInterna(
  section: SiteSection,
  slug: string,
): Promise<Metadata> {
  const page = await getProductPage(section, slug);
  // Página que não existe é 404, e um 404 não deve carregar metadata de coisa
  // nenhuma — devolver title/OG aqui é o que faz um endereço morto aparecer
  // bonito no compartilhamento.
  if (!page) return { robots: { index: false, follow: false } };

  const titulo = page.seoTitle || `${page.title} — ÓRBITA HUB`;

  return metadataDaPagina({
    titulo,
    descricao: descricaoDaPagina(page.seoDescription, page.blocks),
    path: caminhoDaPagina(section, slug),
    ogImageKey: page.ogImage,
    chapeu: SECTION_LABEL[section],
  });
}

export async function renderPaginaInterna(section: SiteSection, slug: string) {
  const [page, content] = await Promise.all([
    getProductPage(section, slug),
    getSiteContent(),
  ]);

  if (!page) notFound();

  const path = caminhoDaPagina(section, slug);
  const descricao = descricaoDaPagina(page.seoDescription, page.blocks);

  // `null` sem endereço público conhecido — ver `lib/seo.ts`.
  const grafo = paginaInternaLd({
    section,
    slug,
    titulo: page.title,
    descricao,
    path,
  });

  return (
    <>
      {grafo && (
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD é a única forma de emitir structured data; o conteúdo é serializado e escapado em `jsonLdScript`
          dangerouslySetInnerHTML={jsonLdScript(grafo)}
        />
      )}
      <SiteProductPage
        blocks={page.blocks}
        whatsappHref={content.whatsapp.href}
        whatsappLabel={content.whatsapp.label}
        loginHref={APP_LINKS.login}
        signupHref={APP_LINKS.signup}
        content={content}
        pagina={{ slug: page.slug, titulo: page.title, config: page.astro }}
        trilha={{ section, titulo: page.title }}
      />
    </>
  );
}
