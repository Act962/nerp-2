import Link from "next/link";
import { BRAND } from "@/orbita/ui/brand";

/**
 * As peças de moldura que a página de bloco e as páginas de trecho dividem.
 *
 * Estavam escritas dentro de `product-page.tsx`. Saíram para cá quando as
 * páginas de trecho (`/solucoes`, `/segmentos`, `/sobre`) passaram a existir:
 * duas páginas com o mesmo rodapé escrito duas vezes é como as duas começam a
 * divergir. A marcação é a mesma de antes, nada foi redesenhado.
 */

export type PassoDaTrilha = {
  nome: string;
  /** Ausente no último passo: a página atual não é link para si mesma. */
  href?: string;
};

/**
 * A trilha de navegação, visível.
 *
 * Existe por dois motivos que se somam. Para quem lê, ela diz onde a pessoa
 * está e dá o caminho de volta — numa página que se chega pelo buscador, esse
 * é o único contexto que existe. Para o buscador, ela é o par visível do
 * `BreadcrumbList` do JSON-LD: structured data tem de descrever o que está na
 * tela, e é isto que está na tela.
 */
export function Trilha({ passos }: { passos: PassoDaTrilha[] }) {
  return (
    <nav className="sp-trilha" aria-label="Trilha de navegação">
      <ol>
        {passos.map((passo, index) => {
          const ultimo = index === passos.length - 1;
          return (
            <li key={passo.nome}>
              {passo.href && !ultimo ? (
                <Link href={passo.href}>{passo.nome}</Link>
              ) : (
                <span aria-current={ultimo ? "page" : undefined}>
                  {passo.nome}
                </span>
              )}
              {!ultimo && (
                <span className="sp-trilha__sep" aria-hidden="true">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * O rodapé das páginas internas.
 *
 * `links` acrescenta a navegação de trecho quando quem chamou tem o que
 * oferecer — é o que tira as páginas de trecho da condição de beco sem saída,
 * onde a única saída era a home.
 */
export function SiteFooter({
  links = [],
}: {
  links?: Array<{ nome: string; href: string }>;
}) {
  return (
    <footer className="sp-foot">
      <Link className="sp-foot__brand" href="/" aria-label="ÓRBITA HUB">
        {/* As dimensões são as INTRÍNSECAS do arquivo, não as de exibição: o
            CSS manda no tamanho (`height: 18px; width: auto`), e os atributos
            servem só para o navegador conhecer a proporção antes de a imagem
            chegar — é isso que reserva o espaço e evita o pulo do rodapé. */}
        {/* biome-ignore lint/performance/noImgElement: asset fixo do site, sem otimização a fazer */}
        <img
          src={BRAND.lockup}
          alt=""
          width={987}
          height={220}
          loading="lazy"
          decoding="async"
        />
      </Link>
      <Link href="/">← Voltar ao site</Link>
      {links.map((link) => (
        <Link key={link.href} href={link.href}>
          {link.nome}
        </Link>
      ))}
      <span className="sp-nav__spacer" />
      <span>© {new Date().getFullYear()} ÓRBITA HUB</span>
    </footer>
  );
}
