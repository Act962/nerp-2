import Link from "next/link";
import { constructUrl } from "@/hooks/use-construct-url";
import { type SiteBlock, youtubeId } from "../blocks";
import "./product-page.css";

/**
 * A página interna de uma solução, montada a partir dos blocos publicados.
 *
 * É um Server Component puro: nenhum bloco tem estado, e a página precisa
 * chegar pronta no HTML por causa da busca. A barra e o rodapé aqui são
 * simples de propósito — os painéis da barra vivem na home, que é onde a cena
 * 3D existe; repetir aquele menu aqui traria a experiência inteira junto.
 */
export function SiteProductPage({
  blocks,
  whatsappHref,
  whatsappLabel,
}: {
  blocks: SiteBlock[];
  whatsappHref: string;
  whatsappLabel: string;
}) {
  return (
    <div className="sp-root">
      <header className="sp-nav">
        <Link className="sp-nav__brand" href="/">
          ÓRBITA
        </Link>
        <span className="sp-nav__spacer" />
        <Link className="sp-btn sp-btn--ghost sp-nav__hide" href="/login">
          Entrar
        </Link>
        <a
          className="sp-btn sp-btn--solid"
          href={whatsappHref}
          target="_blank"
          rel="noreferrer noopener"
        >
          {whatsappLabel}
        </a>
      </header>

      {blocks
        .filter((block) => block.enabled)
        .map((block) => (
          <Block key={block.id} block={block} whatsappHref={whatsappHref} />
        ))}

      <footer className="sp-foot">
        <Link href="/">← Voltar ao site</Link>
        <span className="sp-nav__spacer" />
        <span>© {new Date().getFullYear()} ÓRBITA HUB</span>
      </footer>
    </div>
  );
}

function Block({
  block,
  whatsappHref,
}: {
  block: SiteBlock;
  whatsappHref: string;
}) {
  switch (block.type) {
    case "hero":
      return (
        <section className="sp-hero">
          <div>
            {block.eyebrow && (
              <p className="sp-hero__eyebrow">{block.eyebrow}</p>
            )}
            <h1>{block.title}</h1>
            <p>{block.text}</p>
            <div className="sp-hero__actions">
              {block.primary.label && (
                <Action
                  link={block.primary}
                  variant="light"
                  fallback={whatsappHref}
                />
              )}
              {block.secondary.label && (
                <Action
                  link={block.secondary}
                  variant="outline"
                  fallback={whatsappHref}
                />
              )}
            </div>
          </div>
          <Media image={block.image} />
        </section>
      );

    case "statement":
      return (
        <section className="sp-section sp-statement">
          <h2>{block.title}</h2>
          <p>{block.text}</p>
          {block.cta.label && (
            <Action link={block.cta} variant="solid" fallback={whatsappHref} />
          )}
        </section>
      );

    case "compare":
      return (
        <section className="sp-section">
          {block.title && (
            <h2 style={{ textAlign: "center" }}>{block.title}</h2>
          )}
          <div className="sp-duo">
            <div className="sp-duo__more">
              <h3>{block.moreTitle}</h3>
              <ul>
                {block.more.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="sp-duo__less">
              <h3>{block.lessTitle}</h3>
              <ul>
                {block.less.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      );

    case "features":
      return (
        <section className="sp-section">
          {block.title && (
            <h2 style={{ textAlign: "center" }}>{block.title}</h2>
          )}
          <div className="sp-cards">
            {block.items.map((item) => (
              <article className="sp-card" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>
      );

    case "split":
      return (
        <section
          className={`sp-section sp-split${
            block.imageSide === "right" ? " sp-split--right" : ""
          }`}
        >
          <div className="sp-split__media">
            <Media image={block.image} />
          </div>
          <div>
            <h2>{block.title}</h2>
            {block.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </section>
      );

    case "video": {
      const id = youtubeId(block.youtubeUrl);
      // Sem endereço, a seção inteira não existe — um painel azul vazio seria
      // pior do que a ausência dele.
      if (!id) return null;
      return (
        <section className="sp-video">
          <h2>{block.title}</h2>
          <p>{block.text}</p>
          <iframe
            className="sp-video__frame"
            src={`https://www.youtube-nocookie.com/embed/${id}`}
            title={block.title || "Vídeo"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </section>
      );
    }

    case "clients": {
      const logos = block.logos.filter((logo) => logo.key);
      // Faixa de clientes sem logo nenhuma não vai ao ar: seria uma promessa
      // vazia no meio da página.
      if (logos.length === 0) return null;
      return (
        <section className="sp-clients">
          <h2>{block.title}</h2>
          <div className="sp-clients__row">
            {logos.map((logo) => (
              // biome-ignore lint/performance/noImgElement: logo por key do R2, sem dimensão conhecida
              <img key={logo.key} src={constructUrl(logo.key)} alt={logo.alt} />
            ))}
          </div>
        </section>
      );
    }

    case "contact":
      return (
        <section className="sp-contact">
          <h2>{block.title}</h2>
          <div className="sp-contact__row">
            {block.options.map((option) => (
              <a
                key={option.label}
                href={option.href || whatsappHref}
                {...(/^https?:\/\//.test(option.href || whatsappHref)
                  ? { target: "_blank", rel: "noreferrer noopener" }
                  : null)}
              >
                {option.label}
              </a>
            ))}
          </div>
        </section>
      );
  }
}

function Action({
  link,
  variant,
  fallback,
}: {
  link: { label: string; href: string };
  variant: "light" | "outline" | "solid";
  fallback: string;
}) {
  const href = link.href || fallback;
  const external = /^https?:\/\//.test(href);
  return (
    <a
      className={`sp-btn sp-btn--${variant}`}
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer noopener" } : null)}
    >
      {link.label}
    </a>
  );
}

function Media({ image }: { image: { key: string; alt: string } }) {
  if (!image.key) return <div className="sp-media sp-media--empty" />;
  return (
    // biome-ignore lint/performance/noImgElement: imagem por key do R2, sem dimensão conhecida
    <img className="sp-media" src={constructUrl(image.key)} alt={image.alt} />
  );
}
