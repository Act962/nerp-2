import type { Metadata } from "next";
import Link from "next/link";
import { SECTION_LABEL, SECTION_ORDER } from "@/lib/seo";
import { BRAND } from "@/orbita/ui/brand";
import "@/features/product-page.css";

/**
 * O 404 do site.
 *
 * Sem este arquivo o Next serve a própria tela padrão: fundo branco, "This
 * page could not be found", em inglês, sem marca e sem uma saída. Ela aparece
 * exatamente quando alguém chega de um link velho ou de um resultado de busca
 * que apontava para uma página despublicada — o pior momento possível para o
 * site parecer quebrado.
 *
 * O que ela precisa fazer é uma coisa só: devolver a pessoa para dentro do
 * site. Daí os links para os três trechos, e não só para a home.
 */

/**
 * `noindex, follow`.
 *
 * `noindex` porque um 404 não é conteúdo; `follow` porque os links daqui são
 * bons — é por eles que o rastreador reencontra o que ainda existe. E o Next
 * responde com status 404 de verdade, então o buscador tira o endereço antigo
 * do índice sozinho: não é preciso redirecionar nada.
 */
export const metadata: Metadata = {
  title: "Página não encontrada — ÓRBITA HUB",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="sp-root">
      <header className="sp-nav">
        <Link className="sp-nav__brand" href="/" aria-label="ÓRBITA HUB">
          {/* biome-ignore lint/performance/noImgElement: asset fixo do site, sem otimização a fazer */}
          <img src={BRAND.lockup} alt="" width={987} height={220} />
        </Link>
      </header>

      <div className="sp-band sp-band--claro">
        <section className="sp-section sp-404">
          <p className="sp-hero__eyebrow">Erro 404</p>
          <h1>Esta página saiu de órbita.</h1>
          <p>
            O endereço não existe mais, ou nunca existiu. Nada se perdeu — o
            resto do site continua aqui.
          </p>
          <nav className="sp-404__links" aria-label="Seções do site">
            <Link className="sp-btn sp-btn--solid" href="/">
              Voltar ao início
            </Link>
            {SECTION_ORDER.map((section) => (
              <Link
                key={section}
                className="sp-btn sp-btn--outline"
                href={`/${section}`}
              >
                {SECTION_LABEL[section]}
              </Link>
            ))}
          </nav>
        </section>
      </div>
    </div>
  );
}
