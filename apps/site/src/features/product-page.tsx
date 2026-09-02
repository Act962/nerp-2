import Link from "next/link";
import { type SiteBlock, youtubeId } from "@nerp/site-content";
import { assetUrl } from "@/lib/assets";
import { BRAND } from "@/orbita/ui/brand";
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
  loginHref,
}: {
  blocks: SiteBlock[];
  whatsappHref: string;
  whatsappLabel: string;
  loginHref: string;
}) {
  return (
    <div className="sp-root">
      <header className="sp-nav">
        <Link className="sp-nav__brand" href="/" aria-label="ÓRBITA HUB">
          {/* O logotipo oficial, branco, do mesmo arquivo que a home usa —
              nada redesenhado. */}
          {/* biome-ignore lint/performance/noImgElement: asset fixo do site, sem otimização a fazer */}
          <img src={BRAND.lockup} alt="" />
        </Link>
        <span className="sp-nav__spacer" />
        {/* "Entrar" sai deste app: o login mora no ERP. */}
        <a className="sp-btn sp-btn--ghost sp-nav__hide" href={loginHref}>
          Entrar
        </a>
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
        <Link className="sp-foot__brand" href="/" aria-label="ÓRBITA HUB">
          {/* biome-ignore lint/performance/noImgElement: asset fixo do site, sem otimização a fazer */}
          <img src={BRAND.lockup} alt="" />
        </Link>
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
        // A âncora existe para o segundo botão do herói ter para onde levar.
        <section className="sp-section" id="funcionalidades">
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

    case "steps":
      return (
        <section className="sp-section" id="etapas">
          {block.title && <h2 className="sp-steps__title">{block.title}</h2>}
          {block.text && <p className="sp-steps__lead">{block.text}</p>}
          {block.cycle && block.items.length > 2 && (
            <CycleDiagram
              marks={block.items.map((item) => ({
                mark: item.mark,
                title: item.title,
              }))}
            />
          )}
          <div className="sp-steps">
            {block.items.map((item, index) => (
              <article className="sp-step" key={item.title + item.mark}>
                <div className="sp-step__mark">
                  <span>{item.mark || index + 1}</span>
                  <i>{index + 1}</i>
                </div>
                <div>
                  <h3>{item.title}</h3>
                  {item.question && (
                    <p className="sp-step__q">{item.question}</p>
                  )}
                  {item.text && <p>{item.text}</p>}
                  {item.bullets.length > 0 && (
                    <ul>
                      {item.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </article>
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
              <img key={logo.key} src={assetUrl(logo.key)} alt={logo.alt} />
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

/**
 * As etapas em círculo.
 *
 * O desenho existe para dizer o que uma lista não diz: que o passo a passo é
 * um ciclo, e que o fim alimenta o começo de novo. As posições saem da
 * quantidade de etapas, então ele serve para quatro ou para seis.
 *
 * A seta tracejada volta da última para a SEGUNDA etapa, não para a primeira:
 * num ciclo de decisão, o que recomeça é a análise — a necessidade já foi
 * estabelecida.
 */
function CycleDiagram({
  marks,
}: {
  marks: Array<{ mark: string; title: string }>;
}) {
  const R = 140;
  const C = 210;
  const n = marks.length;

  const ponto = (i: number, raio: number) => {
    const a = (-90 + (360 / n) * i) * (Math.PI / 180);
    return { x: C + raio * Math.cos(a), y: C + raio * Math.sin(a) };
  };

  return (
    <svg
      className="sp-cycle"
      viewBox="0 0 420 420"
      role="img"
      aria-label={`Ciclo: ${marks.map((m) => m.title).join(", ")} — e volta`}
    >
      <title>{`Ciclo: ${marks.map((m) => m.title).join(" → ")}`}</title>
      <defs>
        <marker
          id="sp-seta"
          viewBox="0 0 10 10"
          refX="7"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M0 0 L10 5 L0 10 z" fill="currentColor" />
        </marker>
      </defs>

      <circle
        cx={C}
        cy={C}
        r={R}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.3"
        strokeWidth="1.5"
        strokeDasharray="4 8"
      />

      {marks.slice(0, -1).map((mark, i) => {
        const de = ponto(i + 0.22, R);
        const para = ponto(i + 0.78, R);
        return (
          <path
            key={`arco-${mark.title}`}
            d={`M ${de.x} ${de.y} A ${R} ${R} 0 0 1 ${para.x} ${para.y}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            markerEnd="url(#sp-seta)"
          />
        );
      })}

      {/* a volta: da última etapa para a segunda */}
      <path
        d={`M ${ponto(n - 1, R - 36).x} ${ponto(n - 1, R - 36).y} Q ${C} ${C - 60} ${ponto(1, R - 36).x} ${ponto(1, R - 36).y}`}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.75"
        strokeWidth="2"
        strokeDasharray="5 5"
        markerEnd="url(#sp-seta)"
      />

      {marks.map((mark, i) => {
        const p = ponto(i, R);
        const rotulo = ponto(i, R + 46);
        return (
          <g key={mark.title}>
            <circle className="sp-cycle__no" cx={p.x} cy={p.y} r="34" />
            <text className="sp-cycle__letra" x={p.x} y={p.y + 9}>
              {mark.mark || i + 1}
            </text>
            <text className="sp-cycle__rot" x={rotulo.x} y={rotulo.y + 4}>
              {mark.title.toUpperCase()}
            </text>
          </g>
        );
      })}
    </svg>
  );
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
    <img className="sp-media" src={assetUrl(image.key)} alt={image.alt} />
  );
}
